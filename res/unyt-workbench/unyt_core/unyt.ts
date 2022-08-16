/**
 ╔══════════════════════════════════════════════════════════════════════════════════════╗
 ║  UNYT Interface                                                                      ║
 ╠══════════════════════════════════════════════════════════════════════════════════════╣
 ║  Handler for unyt login and communication                                            ║
 ║  Visit docs.unyt.cc/unyt for more information                                        ║
 ╠═════════════════════════════════════════╦════════════════════════════════════════════╣
 ║  © 2020 Jonas & Benedikt Strehle        ║                                            ║
 ╚═════════════════════════════════════════╩════════════════════════════════════════════╝
 */


import Logger, { console_theme, font_family } from "./logger.js";
import { DatexCommonInterface } from "./datex_client.js";
import DatexCloud from "./datex_cloud.js";
import { remote, root_extension, to } from "./legacy_decorators.js";
import { Datex} from "./datex_runtime.js";
const logger = new Logger("unyt");
const client_type = globalThis.process?.release?.name ? 'node' : 'browser'

DatexCloud.onConnect = ()=>{
    Unyt.logStatus({endpoint:Datex.Runtime.endpoint, node:Datex.Runtime.main_node, app:'', type: DatexCommonInterface.default_interface.type, mode: 'Development', license: 'unyt.org'}); 
}

export default class Unyt {

    static async login(endpoint: Datex.Addresses.Endpoint, password: string):Promise<boolean> {
        if (!endpoint) throw new Error("no endpoint");
        if (!password) throw new Error("no password");

        // create hash from password
        let hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(password))
        try {
            //let res:[ArrayBuffer, ArrayBuffer, ArrayBuffer, ArrayBuffer] = await datex('get_private_keys(?,?)', [endpoint, hash], '+unyt/auth', false) // get private key data from unyt auth server
            let res = await Auth.get_private_keys(endpoint, hash);
            let [sign_key, dec_key] = await this.decryptPrivateKeys(...res, password); // extract private keys from data
            let public_keys_base64  = await Datex.NetworkUtils.get_keys(endpoint); //  get public keys (TODO get from blockchain)
            // load public keys
            let verify_key = await Datex.Crypto.importVerifyKey(public_keys_base64[0]);
            let enc_key = await Datex.Crypto.importEncKey(public_keys_base64[1]);
            //logger.success("private keys reconstructed");

            return await DatexCloud.connect(endpoint, Datex.Runtime.endpoint.id_endpoint, true, [verify_key, sign_key], [enc_key, dec_key]);

        } catch (e) {
            console.error(e)
            return false
        }
    }

    static async register(endpoint: Datex.Addresses.Endpoint, password: string):Promise<boolean> {
        if (!endpoint) throw new Error("no endpoint");
        if (!password) throw new Error("no password");

        let hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(password))

        try {
            // send private key data to unyt auth server
            let res = await Auth.set_private_keys(endpoint, hash, ...(await this.encryptPrivateKeys(...Datex.Crypto.getOwnPrivateKeys(), password)))
            let current_endpoint = Datex.Runtime.endpoint.id_endpoint;
            // --- TODO just temporary; save in blockchain
            if (!endpoint.id_endpoint) endpoint.setIdEndpoint(current_endpoint);
            Datex.Runtime.endpoint = endpoint;
            await DatexCloud.sayHello();  // say hello, send current public keys to server
            Datex.Runtime.endpoint = current_endpoint;
            logger.success("register: " + endpoint + ", password = " + password, res);
            return true;
        } catch (e) {
            console.error(e)
            return false;
        }
    }

    /** returns password-encrypted sign and encryption keys and respective ivs */
    static async encryptPrivateKeys(sign_key:CryptoKey, dec_key:CryptoKey, password: string): Promise<[ArrayBuffer, ArrayBuffer, ArrayBuffer, ArrayBuffer]>{
        // get buffers from keys
        const sign_key_buffer = new Uint8Array(await globalThis.crypto.subtle.exportKey("pkcs8", sign_key))
        const dec_key_buffer  = new Uint8Array(await globalThis.crypto.subtle.exportKey("pkcs8", dec_key))
    
        // generate ivs
        const iv_sign = globalThis.crypto.getRandomValues(new Uint8Array(16));
        const iv_dec  = globalThis.crypto.getRandomValues(new Uint8Array(16));

        // get key from password
        const key = await this.getKeyFromPassword(password);
       
        // encrypt keys
        const sign_key_dec = await crypto.subtle.encrypt({name: 'AES-GCM', tagLength: 32, iv: iv_sign}, key, sign_key_buffer)
        const dec_key_enc  = await crypto.subtle.encrypt({name: 'AES-GCM', tagLength: 32, iv: iv_dec}, key, dec_key_buffer)
       
        return [sign_key_dec, dec_key_enc, iv_sign.buffer, iv_dec.buffer]
    }

    /** returns decrypted sign and encryption keys */
    static async decryptPrivateKeys(sign_key_enc: ArrayBuffer, dec_key_enc: ArrayBuffer, iv_sign: ArrayBuffer, iv_dec: ArrayBuffer, password: string) {
        // get key from password
        const key = await this.getKeyFromPassword(password);

        const sign_key_buffer = await crypto.subtle.decrypt({name: 'AES-GCM', tagLength: 32, iv: iv_sign}, key, sign_key_enc)
        const dec_key_buffer = await crypto.subtle.decrypt({name: 'AES-GCM', tagLength: 32, iv: iv_dec}, key, dec_key_enc)
        
        // decrypt keys
        const sign_key = await Datex.Crypto.importSignKey(sign_key_buffer)
        const dec_key =  await Datex.Crypto.importDecKey(dec_key_buffer)
        
        return [sign_key, dec_key]
    }

    private static async getKeyFromPassword(password: string): Promise<CryptoKey> {
        const d_key = await window.crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits", "deriveKey"]);
        return await window.crypto.subtle.deriveKey(
            {
              "name": "PBKDF2",
              salt: Uint8Array.from([1,2,3,4,5,6,7,8]),
              "iterations": 100000,
              "hash": "SHA-256"
            },
            d_key,
            { "name": "AES-GCM", "length": 256},
            true,
            [ "encrypt", "decrypt" ]
        );
    }

    private static logo_dark = 'data:image/svg+xml;charset=UTF-8,<?xml version="1.0" encoding="UTF-8" standalone="no"?> <!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd"> <svg width="100%" height="100%" viewBox="0 0 752 330" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" xml:space="preserve" xmlns:serif="http://www.serif.com/" style="fill-rule:evenodd;clip-rule:evenodd;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:1.5;"> <g id="Artboard1" transform="matrix(0.978389,0,0,0.982981,-18.8476,-128.716)"> <rect x="19.264" y="130.945" width="768.489" height="335.033" style="fill:none;"/> <g transform="matrix(1.02209,0,0,1.01731,-17.1301,-7.10669)"> <g transform="matrix(0.470253,0,0,0.470253,-5.86419,62.6463)"> <circle cx="461.453" cy="512.042" r="278.081" style="fill:rgb(42,42,42);stroke:white;stroke-width:9.57px;"/> </g> <g transform="matrix(2.66926,0,-1.85999e-16,2.80415,-833.638,-1450.05)"> <ellipse cx="382.029" cy="632.834" rx="16.147" ry="15.357" style="fill:rgb(42,170,215);"/> </g> <g transform="matrix(2.66926,0,-1.85999e-16,2.80415,-777.781,-1449.74)"> <ellipse cx="382.029" cy="632.834" rx="16.147" ry="15.357" style="fill:rgb(255,0,89);"/> </g> <g transform="matrix(3.35067,0,0,3.35067,-1441.41,-1780.79)"> <path d="M494.114,618.584C496.853,620.942 498.589,624.432 498.589,628.324C498.589,632.267 496.807,635.798 494.006,638.155C491.267,635.798 489.532,632.308 489.532,628.416C489.532,624.473 491.313,620.942 494.114,618.584Z" style="fill:rgb(195,132,203);"/> </g> </g> <g transform="matrix(2.72822,0,-1.90107e-16,2.8527,-843.002,-1528.62)"> <ellipse cx="382.029" cy="632.834" rx="16.147" ry="15.357" style="fill:white;"/> </g> <g transform="matrix(3.42468,0,0,3.40868,-1490.38,-1818.73)"> <path d="M489.608,627.016C490.307,620.58 495.77,615.564 502.396,615.564C503.704,615.564 504.967,615.76 506.157,616.123C505.458,622.559 499.995,627.575 493.369,627.575C492.061,627.575 490.798,627.379 489.608,627.016Z" style="fill:rgb(238,133,170);"/> </g> <g transform="matrix(3.42468,0,0,3.40868,-1490.38,-1818.73)"> <path d="M480.631,616.521C482.194,615.846 483.916,615.472 485.725,615.472C492.214,615.472 497.587,620.283 498.464,626.526C496.901,627.201 495.178,627.575 493.369,627.575C486.88,627.575 481.507,622.764 480.631,616.521Z" style="fill:rgb(159,230,255);"/> </g> <g transform="matrix(3.42468,0,0,3.40868,-1490.38,-1818.73)"> <path d="M494.114,618.584C496.424,620.572 498.02,623.366 498.464,626.526C496.901,627.201 495.178,627.575 493.369,627.575C492.061,627.575 490.798,627.379 489.608,627.016C489.974,623.643 491.649,620.66 494.114,618.584Z" style="fill:white;"/> </g> <g transform="matrix(1.46106,0,0,1.45424,377.481,353.096)"> <text x="0px" y="0px" style="font-family:\\\'ArialRoundedMTBold\\\', \\\'Arial Rounded MT Bold\\\', sans-serif;font-size:114.167px;fill:white;">unyt</text> </g> </g> </svg>';
    private static logo_light = 'data:image/svg+xml;charset=UTF-8,<?xml version="1.0" encoding="UTF-8" standalone="no"?> <!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd"> <svg width="100%" height="100%" viewBox="0 0 752 330" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" xml:space="preserve" xmlns:serif="http://www.serif.com/" style="fill-rule:evenodd;clip-rule:evenodd;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:1.5;"> <g id="Artboard1" transform="matrix(0.978389,0,0,0.982981,-18.8476,-128.716)"> <rect x="19.264" y="130.945" width="768.489" height="335.033" style="fill:none;"/> <g transform="matrix(1.02209,0,0,1.01731,-17.1301,-7.10669)"> <g transform="matrix(0.470253,0,0,0.470253,-5.86419,62.6463)"> <circle cx="461.453" cy="512.042" r="278.081" style="fill:rgb(42,42,42);stroke:white;stroke-width:9.57px;"/> </g> <g transform="matrix(2.66926,0,-1.85999e-16,2.80415,-833.638,-1450.05)"> <ellipse cx="382.029" cy="632.834" rx="16.147" ry="15.357" style="fill:rgb(42,170,215);"/> </g> <g transform="matrix(2.66926,0,-1.85999e-16,2.80415,-777.781,-1449.74)"> <ellipse cx="382.029" cy="632.834" rx="16.147" ry="15.357" style="fill:rgb(255,0,89);"/> </g> <g transform="matrix(3.35067,0,0,3.35067,-1441.41,-1780.79)"> <path d="M494.114,618.584C496.853,620.942 498.589,624.432 498.589,628.324C498.589,632.267 496.807,635.798 494.006,638.155C491.267,635.798 489.532,632.308 489.532,628.416C489.532,624.473 491.313,620.942 494.114,618.584Z" style="fill:rgb(195,132,203);"/> </g> </g> <g transform="matrix(2.72822,0,-1.90107e-16,2.8527,-843.002,-1528.62)"> <ellipse cx="382.029" cy="632.834" rx="16.147" ry="15.357" style="fill:white;"/> </g> <g transform="matrix(3.42468,0,0,3.40868,-1490.38,-1818.73)"> <path d="M489.608,627.016C490.307,620.58 495.77,615.564 502.396,615.564C503.704,615.564 504.967,615.76 506.157,616.123C505.458,622.559 499.995,627.575 493.369,627.575C492.061,627.575 490.798,627.379 489.608,627.016Z" style="fill:rgb(238,133,170);"/> </g> <g transform="matrix(3.42468,0,0,3.40868,-1490.38,-1818.73)"> <path d="M480.631,616.521C482.194,615.846 483.916,615.472 485.725,615.472C492.214,615.472 497.587,620.283 498.464,626.526C496.901,627.201 495.178,627.575 493.369,627.575C486.88,627.575 481.507,622.764 480.631,616.521Z" style="fill:rgb(159,230,255);"/> </g> <g transform="matrix(3.42468,0,0,3.40868,-1490.38,-1818.73)"> <path d="M494.114,618.584C496.424,620.572 498.02,623.366 498.464,626.526C496.901,627.201 495.178,627.575 493.369,627.575C492.061,627.575 490.798,627.379 489.608,627.016C489.974,623.643 491.649,620.66 494.114,618.584Z" style="fill:white;"/> </g> <g transform="matrix(1.46106,0,0,1.45424,377.481,353.096)"> <text x="0px" y="0px" style="font-family:\\\'ArialRoundedMTBold\\\', \\\'Arial Rounded MT Bold\\\', sans-serif;font-size:114.167px;fill:grey;">unyt</text> </g> </g> </svg>';


    // TODO add colored logo dark - light mode
    public static logStatus(data:any){
        let endpoint = "%c" + data.endpoint?.toString()?.replace(/\%/g,'%%');

        if (client_type == "node") {
            console.log(`Connected to the supranet via %c${data.node} %c(${data.type}`)
            return;
        }

        console.log(
            `%cunyt %c${data.version || ""}\n` +

            `%c   Connected to the supranet via %c${data.node} %c(${data.type})\n` +

            `%c   [MODE]%c     ${data.mode}\n` +
            `%c   [APP]%c      ${data.app}\n` +
            `%c   [LICENSE]%c  ${data.license}\n` +
            `%c   [ENDPOINT]%c ${endpoint}\n` +
            `%cEnable debug mode for this endpoint: https://r.unyt.cc/${endpoint.replace("%c", "")}\n`+
            `%c© ${new Date().getFullYear()} unyt.org`,

            `font-size:50px;color:#fff;font-weight:bold;padding-bottom:15px;`, // #f9025a
            //`color:transparent;font-size:100px; margin-top:15px;background:url('${console_theme=="dark"?this.logo_dark:this.logo_light}');background-size: 200px 200px;background-repeat:no-repeat;`,
            `color:#aaa;font-size:18px;margin-left:-115px;${font_family};margin-top:20px`,

            `color:#aaa;${font_family};margin-left:115px;`,
            `font-weight:bold;color:#1eda6d; padding-top:10px;${font_family}`,
            `color:#aaa;${font_family};`,

            `color:#1eda6d;margin-left:0px; padding-top:10px;${font_family}`,

            `color:#aaa;padding:0px;${font_family};margin-left:0px;`,
            `color:#1eda6d; padding-top:3px;${font_family}`,
            `color:#aaa;padding:0px;${font_family}`,
            `color:#1eda6d;padding-top:3px;${font_family}`,
            `color:#aaa;padding:0px;${font_family}`,
            `color:#1eda6d;padding-top:3px;${font_family}`,
            `color:#aaa;padding:0px;${font_family}`,
            `color:inherit;${font_family}`,
            `color:#0669c1;${font_family};margin-left:20px;padding-top:10px;padding-bottom:5px;${font_family}`,
            `color:#aaa;${font_family};padding-top:10px;margin-bottom:30px;${font_family}`

        )

    }


}


@root_extension @to('@+unyt:auth') class Auth {
    @remote static get_private_keys(endpoint: Datex.Addresses.Endpoint, hash: ArrayBuffer): Promise<[ArrayBuffer, ArrayBuffer, ArrayBuffer, ArrayBuffer]> {return null}
    @remote static set_private_keys(endpoint: Datex.Addresses.Endpoint, hash: ArrayBuffer, sign_key: ArrayBuffer, dec_key: ArrayBuffer, iv_sign: ArrayBuffer, iv_dec: ArrayBuffer): Promise<boolean> {return null}
}

globalThis.Unyt = Unyt