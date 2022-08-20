import Logger from "../unyt_core/logger.js";
import express from "express";
import http from "http";
import cors from 'cors';
import shrinkRay from 'shrink-ray-current';
import subdomain from 'express-subdomain';
import cookieParser from 'cookie-parser';
const logger = new Logger("web_server");
const COOKIE_SECRET = "njh23zjodÖÄA=)JNCBnvoaidjsako1mncvdfsnuafhlaidosfjmDASDFAJFEDNnbcuai28z9ueaof9jnncbgaabdADAF";
const ALLOWED_ORIGINS = [
    'https://unyt.org',
    'https://workbench.unyt.org',
    'https://oma.unyt.org',
    'https://opa.unyt.org',
    'https://auth.unyt.org',
    'https://marketplace.unyt.org',
    'https://docs.unyt.org',
    'https://unyt.cc',
    'https://unyt.app',
    'https://app.unyt.org',
    'https://meet.unyt.org',
    'https://myzelion.com',
    'https://admin.myzelion.com',
    'https://orders.myzelion.com',
    'https://shop.myzelion.com',
    'https://school.unyt.app',
    'https://portal2.quetheb.de',
    'chrome-extension://gohadkeicbkbjkjlfacokmaiodhbpghl'
];
express.static.mime.define({ 'text/datex': ['dx'] });
express.static.mime.define({ 'application/datex': ['dxb'] });
export default class WebServer {
    static express;
    static http;
    static port;
    static sub_domains = {};
    static async launch(port = parseInt(process.env.UNYT_INTERNAL_PORT) || 8080, authorized_access_only = true) {
        this.port = port;
        this.express = express();
        this.http = new http.Server(this.express);
        this.express.use(cors({
            credentials: true,
            origin: function (origin, callback) {
                if (!authorized_access_only)
                    return callback(null, true);
                if (!origin)
                    return callback(null, true);
                if (ALLOWED_ORIGINS.indexOf(origin) === -1) {
                    var msg = 'The CORS policy for this site does not ' +
                        'allow access from the specified Origin.';
                    return callback(new Error(msg), false);
                }
                return callback(null, true);
            }
        }));
        this.express.use(cookieParser());
        if (authorized_access_only) {
            this.express.use("/authorize/:secret", (req, res) => {
                let secret = req.params?.secret;
                console.log('Authorization attempt with secret: ' + secret);
                if (secret == COOKIE_SECRET) {
                    res.cookie("secret", secret, {
                        domain: '.' + req.hostname,
                        path: '/',
                        maxAge: ((((1000 * 60) * 60) * 24) * 365),
                        httpOnly: true
                    });
                    res.end('[ Successful authorization to ' + req.hostname + ' / unyt.org ]');
                    console.log(' => Successful authorization');
                }
                else {
                    console.log(' => Authorization failed');
                    res.status(403);
                    res.end();
                }
            });
        }
        this.express.use(function (req, res, next) {
            if (!authorized_access_only || req.headers.host == 'oma.unyt.org' || req.headers.origin == 'https://app.unyt.org' || req.headers.origin == 'https://meet.unyt.org' || req.headers.origin == 'https://unyt.app' || req.headers.referer?.startsWith('https://unyt.app/') || req.headers.referer?.startsWith('https://app.unyt.org/') || req.headers.referer?.startsWith('https://meet.unyt.org/') || req.headers.referer?.startsWith('https://admin.myzelion.com/') || req.headers.referer?.startsWith('https://orders.myzelion.com/') || req.headers.referer?.startsWith('https://workbench.unyt.org/') || req.headers.referer?.startsWith('https://oma.unyt.org/') || req.headers.referer?.startsWith('https://myzelion.com/') || req.headers.referer?.startsWith('https://shop.myzelion.com/') || req.headers['x-forwarded-host'] == 'workbench.unyt.org' || req.headers['x-forwarded-host'] == 'admin.myzelion.com' || req.headers['x-forwarded-host'] == 'orders.myzelion.com' || req.headers.origin == 'https://admin.quetheb.de' || req.headers.referer == 'https://admin.quetheb.de/' || req.headers.origin == 'https://school.unyt.app' || req.headers.referer?.startsWith('https://school.unyt.app/') || req.headers['sec-fetch-dest'] == 'style' || req.headers['accept']?.startsWith("text/css,")) {
            }
            else if (req.cookies?.secret !== COOKIE_SECRET) {
                console.log(req.headers);
                console.log("Request from unauthorized client");
                res.status(403);
                res.end();
                return;
            }
            res.setHeader("Content-Disposition", "inline");
            res.setHeader("X-Content-Type-Options", "nosniff");
            if (req.rawHeaders.includes('serviceworker')) {
                res.setHeader("Service-Worker-Allowed", "/");
            }
            if (!req.cookies['SameSite'])
                res.setHeader("Set-Cookie", ["SameSite=Strict", "Secure"]);
            next();
        });
        this.express.use(shrinkRay());
        this.express.get("/ping", (req, res) => {
            res.end(new Date().getTime().toString());
        });
        return new Promise(resolve => {
            this.http.listen(port, () => {
                logger.success(`${this.name} running on __${process.env.UNYT_HOST}__ (internal port ${process.env.UNYT_INTERNAL_PORT})`);
                resolve();
            });
        });
    }
    static sub_domain(name) {
        let sub_domain_router = express.Router();
        this.sub_domains[name] = sub_domain_router;
        sub_domain_router.get("*", (req, res) => {
            res.send("RAW FILES");
        });
        this.express.use(subdomain(name, sub_domain_router));
        return sub_domain_router;
    }
    static add_static_dir(mount, path) {
        this.express.use(mount, express.static(path));
    }
    static add_login(key = "key::JxjsIuymPq37hx9YAL9284xHS2mx9JWndW3h8a8t2T3H9E8F9u2c8k") {
        logger.success(`Successfully secured access to server __${process.env.UNYT_HOST}__.\nPlease verify using this url: \n\thttps://${process.env.UNYT_HOST}/login?c=${encodeURIComponent(key)}\n`);
        this.express.use((req, res, next) => {
            if (req.originalUrl.startsWith("/login")) {
                res.cookie("unyt::login", req.query.c);
                res.redirect("/");
            }
            else if (!decodeURIComponent(req.headers.cookie).includes(key))
                res.status(404).send("unyt::internal");
            else
                next();
        });
    }
}
