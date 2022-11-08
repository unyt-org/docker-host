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


import { Logger, console_theme, font_family } from "../utils/logger.js";
import { CommonInterface } from "./client.js";
import { remote, scope, to } from "../js_adapter/legacy_decorators.js";
import { Runtime } from "../runtime/runtime.js";
import { Endpoint } from "../types/addressing.js";
import { crypto, Crypto } from "../runtime/crypto.js";
import { NetworkUtils } from "./network_utils.js";
import { Datex } from "../datex.js";

const logger = new Logger("unyt");
const client_type = globalThis.process?.release?.name ? 'node' : 'browser'

Datex.Supranet.onConnect = ()=>{
    Unyt.logStatus({endpoint:Runtime.endpoint, node:Runtime.main_node, app:'', type: CommonInterface.default_interface.type, mode: 'Development', license: 'unyt.org'}); 
}

export class Unyt {

    static async login(endpoint: Endpoint, password: string):Promise<boolean> {
        if (!endpoint) return false
        if (!password) return false

        // create hash from password
        let hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(password))
        try {
            //let res:[ArrayBuffer, ArrayBuffer, ArrayBuffer, ArrayBuffer] = await datex('get_private_keys(?,?)', [endpoint, hash], '+unyt/auth', false) // get private key data from unyt auth server
            let res = await Auth.get_private_keys(endpoint, hash);
            let [sign_key, dec_key] = await this.decryptPrivateKeys(...res, password); // extract private keys from data
            logger.success("private keys reconstructed for ?", endpoint);
            let public_keys_base64  = await NetworkUtils.get_keys(endpoint); //  get public keys (TODO get from blockchain)
            // load public keys
            let verify_key = await Crypto.importVerifyKey(public_keys_base64[0]);
            let enc_key = await Crypto.importEncKey(public_keys_base64[1]);

            return await Datex.Supranet.connect(endpoint, Runtime.endpoint.id_endpoint, true, [verify_key, sign_key], [enc_key, dec_key]);

        } catch (e) {
            console.error(e)
            return false
        }
    }

    static async register(endpoint: Endpoint, password: string):Promise<boolean> {
        if (!endpoint) return false
        if (!password) return false

        let hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(password))

        try {
            // send private key data to unyt auth server
            let res = await Auth.set_private_keys(endpoint, hash, ...(await this.encryptPrivateKeys(...Crypto.getOwnPrivateKeys(), password)))
            let current_endpoint = Runtime.endpoint.id_endpoint;
            // --- TODO just temporary; save in blockchain
            if (!endpoint.id_endpoint) endpoint.setIdEndpoint(current_endpoint);
            Runtime.endpoint = endpoint;
            await Datex.Supranet.sayHello();  // say hello, send current public keys to server
            Runtime.endpoint = current_endpoint;
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
        const sign_key = await Crypto.importSignKey(sign_key_buffer)
        const dec_key =  await Crypto.importDecKey(dec_key_buffer)
        
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

    private static logo_light = 'data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiIHN0YW5kYWxvbmU9Im5vIj8+CjwhRE9DVFlQRSBzdmcgUFVCTElDICItLy9XM0MvL0RURCBTVkcgMS4xLy9FTiIgImh0dHA6Ly93d3cudzMub3JnL0dyYXBoaWNzL1NWRy8xLjEvRFREL3N2ZzExLmR0ZCI+Cjxzdmcgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgdmlld0JveD0iMCAwIDc1MiAzMzAiIHZlcnNpb249IjEuMSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB4bWxuczp4bGluaz0iaHR0cDovL3d3dy53My5vcmcvMTk5OS94bGluayIgeG1sOnNwYWNlPSJwcmVzZXJ2ZSIgeG1sbnM6c2VyaWY9Imh0dHA6Ly93d3cuc2VyaWYuY29tLyIgc3R5bGU9ImZpbGwtcnVsZTpldmVub2RkO2NsaXAtcnVsZTpldmVub2RkO3N0cm9rZS1saW5lY2FwOnJvdW5kO3N0cm9rZS1saW5lam9pbjpyb3VuZDtzdHJva2UtbWl0ZXJsaW1pdDoxLjU7Ij4KICAgIDxnIGlkPSJBcnRib2FyZDEiIHRyYW5zZm9ybT0ibWF0cml4KDAuOTc4Mzg5LDAsMCwwLjk4Mjk4MSwtMTguODQ3NiwtMTI4LjcxNikiPgogICAgICAgIDxyZWN0IHg9IjE5LjI2NCIgeT0iMTMwLjk0NSIgd2lkdGg9Ijc2OC40ODkiIGhlaWdodD0iMzM1LjAzMyIgc3R5bGU9ImZpbGw6bm9uZTsiLz4KICAgICAgICA8ZyB0cmFuc2Zvcm09Im1hdHJpeCgxLjAyMjA5LDAsMCwxLjAxNzMxLC0xNy4xMzAxLC03LjEwNjY5KSI+CiAgICAgICAgICAgIDxnIHRyYW5zZm9ybT0ibWF0cml4KDAuNDcwMjUzLDAsMCwwLjQ3MDI1MywtNS44NjQxOSw2Mi42NDYzKSI+CiAgICAgICAgICAgICAgICA8Y2lyY2xlIGN4PSI0NjEuNDUzIiBjeT0iNTEyLjA0MiIgcj0iMjc4LjA4MSIgc3R5bGU9ImZpbGw6cmdiKDQyLDQyLDQyKTtzdHJva2U6d2hpdGU7c3Ryb2tlLXdpZHRoOjkuNTdweDsiLz4KICAgICAgICAgICAgPC9nPgogICAgICAgICAgICA8ZyBpZD0iX0ltYWdlMV8iIHRyYW5zZm9ybT0ibWF0cml4KDAuOTk2NDU0LDAsMCwwLjk5NTY5MywxMzQuNzc3LDI3My4yMzIpIj4KICAgICAgICAgICAgICAgIDx1c2UgeGxpbms6aHJlZj0iI19JbWFnZTEiIHg9IjAiIHk9IjAiIHdpZHRoPSIxMDNweCIgaGVpZ2h0PSIxMDNweCIvPgogICAgICAgICAgICA8L2c+CiAgICAgICAgICAgIDxnIHRyYW5zZm9ybT0ibWF0cml4KDIuNjY5MjYsMCwtMS44NTk5OWUtMTYsMi44MDQxNSwtODMzLjYzOCwtMTQ1MC4wNSkiPgogICAgICAgICAgICAgICAgPGVsbGlwc2UgY3g9IjM4Mi4wMjkiIGN5PSI2MzIuODM0IiByeD0iMTYuMTQ3IiByeT0iMTUuMzU3IiBzdHlsZT0iZmlsbDpyZ2IoNDIsMTcwLDIxNSk7Ii8+CiAgICAgICAgICAgIDwvZz4KICAgICAgICAgICAgPGcgaWQ9Il9JbWFnZTJfIiB0cmFuc2Zvcm09Im1hdHJpeCgwLjk5Mzc3OCwwLDAsMC45OTk2MDgsMTcwLjM5OSwyNTMuMzQ3KSI+CiAgICAgICAgICAgICAgICA8dXNlIHhsaW5rOmhyZWY9IiNfSW1hZ2UyIiB4PSIwIiB5PSIwIiB3aWR0aD0iMTQ0cHgiIGhlaWdodD0iMTQzcHgiLz4KICAgICAgICAgICAgPC9nPgogICAgICAgICAgICA8ZyB0cmFuc2Zvcm09Im1hdHJpeCgyLjY2OTI2LDAsLTEuODU5OTllLTE2LDIuODA0MTUsLTc3Ny43ODEsLTE0NDkuNzQpIj4KICAgICAgICAgICAgICAgIDxlbGxpcHNlIGN4PSIzODIuMDI5IiBjeT0iNjMyLjgzNCIgcng9IjE2LjE0NyIgcnk9IjE1LjM1NyIgc3R5bGU9ImZpbGw6cmdiKDI1NSwwLDg5KTsiLz4KICAgICAgICAgICAgPC9nPgogICAgICAgICAgICA8ZyB0cmFuc2Zvcm09Im1hdHJpeCgzLjM1MDY3LDAsMCwzLjM1MDY3LC0xNDQxLjQxLC0xNzgwLjc5KSI+CiAgICAgICAgICAgICAgICA8cGF0aCBkPSJNNDk0LjExNCw2MTguNTg0QzQ5Ni44NTMsNjIwLjk0MiA0OTguNTg5LDYyNC40MzIgNDk4LjU4OSw2MjguMzI0QzQ5OC41ODksNjMyLjI2NyA0OTYuODA3LDYzNS43OTggNDk0LjAwNiw2MzguMTU1QzQ5MS4yNjcsNjM1Ljc5OCA0ODkuNTMyLDYzMi4zMDggNDg5LjUzMiw2MjguNDE2QzQ4OS41MzIsNjI0LjQ3MyA0OTEuMzEzLDYyMC45NDIgNDk0LjExNCw2MTguNTg0WiIgc3R5bGU9ImZpbGw6cmdiKDE5NSwxMzIsMjAzKTsiLz4KICAgICAgICAgICAgPC9nPgogICAgICAgICAgICA8ZyBpZD0iX0ltYWdlM18iIHRyYW5zZm9ybT0ibWF0cml4KDAuOTk1MjUsMCwwLDAuOTk0NjA3LDE1NC45NzgsMjIyLjI0NikiPgogICAgICAgICAgICAgICAgPHVzZSB4bGluazpocmVmPSIjX0ltYWdlMyIgeD0iMCIgeT0iMCIgd2lkdGg9IjExNHB4IiBoZWlnaHQ9IjExNHB4Ii8+CiAgICAgICAgICAgIDwvZz4KICAgICAgICA8L2c+CiAgICAgICAgPGcgdHJhbnNmb3JtPSJtYXRyaXgoMi43MjgyMiwwLC0xLjkwMTA3ZS0xNiwyLjg1MjcsLTg0My4wMDIsLTE1MjguNjIpIj4KICAgICAgICAgICAgPGVsbGlwc2UgY3g9IjM4Mi4wMjkiIGN5PSI2MzIuODM0IiByeD0iMTYuMTQ3IiByeT0iMTUuMzU3IiBzdHlsZT0iZmlsbDp3aGl0ZTsiLz4KICAgICAgICA8L2c+CiAgICAgICAgPGcgdHJhbnNmb3JtPSJtYXRyaXgoMy40MjQ2OCwwLDAsMy40MDg2OCwtMTQ5MC4zOCwtMTgxOC43MykiPgogICAgICAgICAgICA8cGF0aCBkPSJNNDg5LjYwOCw2MjcuMDE2QzQ5MC4zMDcsNjIwLjU4IDQ5NS43Nyw2MTUuNTY0IDUwMi4zOTYsNjE1LjU2NEM1MDMuNzA0LDYxNS41NjQgNTA0Ljk2Nyw2MTUuNzYgNTA2LjE1Nyw2MTYuMTIzQzUwNS40NTgsNjIyLjU1OSA0OTkuOTk1LDYyNy41NzUgNDkzLjM2OSw2MjcuNTc1QzQ5Mi4wNjEsNjI3LjU3NSA0OTAuNzk4LDYyNy4zNzkgNDg5LjYwOCw2MjcuMDE2WiIgc3R5bGU9ImZpbGw6cmdiKDIzOCwxMzMsMTcwKTsiLz4KICAgICAgICA8L2c+CiAgICAgICAgPGcgdHJhbnNmb3JtPSJtYXRyaXgoMy40MjQ2OCwwLDAsMy40MDg2OCwtMTQ5MC4zOCwtMTgxOC43MykiPgogICAgICAgICAgICA8cGF0aCBkPSJNNDgwLjYzMSw2MTYuNTIxQzQ4Mi4xOTQsNjE1Ljg0NiA0ODMuOTE2LDYxNS40NzIgNDg1LjcyNSw2MTUuNDcyQzQ5Mi4yMTQsNjE1LjQ3MiA0OTcuNTg3LDYyMC4yODMgNDk4LjQ2NCw2MjYuNTI2QzQ5Ni45MDEsNjI3LjIwMSA0OTUuMTc4LDYyNy41NzUgNDkzLjM2OSw2MjcuNTc1QzQ4Ni44OCw2MjcuNTc1IDQ4MS41MDcsNjIyLjc2NCA0ODAuNjMxLDYxNi41MjFaIiBzdHlsZT0iZmlsbDpyZ2IoMTU5LDIzMCwyNTUpOyIvPgogICAgICAgIDwvZz4KICAgICAgICA8ZyB0cmFuc2Zvcm09Im1hdHJpeCgzLjQyNDY4LDAsMCwzLjQwODY4LC0xNDkwLjM4LC0xODE4LjczKSI+CiAgICAgICAgICAgIDxwYXRoIGQ9Ik00OTQuMTE0LDYxOC41ODRDNDk2LjQyNCw2MjAuNTcyIDQ5OC4wMiw2MjMuMzY2IDQ5OC40NjQsNjI2LjUyNkM0OTYuOTAxLDYyNy4yMDEgNDk1LjE3OCw2MjcuNTc1IDQ5My4zNjksNjI3LjU3NUM0OTIuMDYxLDYyNy41NzUgNDkwLjc5OCw2MjcuMzc5IDQ4OS42MDgsNjI3LjAxNkM0ODkuOTc0LDYyMy42NDMgNDkxLjY0OSw2MjAuNjYgNDk0LjExNCw2MTguNTg0WiIgc3R5bGU9ImZpbGw6d2hpdGU7Ii8+CiAgICAgICAgPC9nPgogICAgICAgIDxnIHRyYW5zZm9ybT0ibWF0cml4KDEuNDYxMDYsMCwwLDEuNDU0MjQsMzc3LjQ4MSwzNTMuMDk2KSI+CiAgICAgICAgICAgIDx0ZXh0IHg9IjBweCIgeT0iMHB4IiBzdHlsZT0iZm9udC1mYW1pbHk6J0FyaWFsUm91bmRlZE1UQm9sZCcsICdBcmlhbCBSb3VuZGVkIE1UIEJvbGQnLCBzYW5zLXNlcmlmO2ZvbnQtc2l6ZToxMTQuMTY3cHg7ZmlsbDpyZ2IoNDQsNDQsNDQpOyI+dW55dDwvdGV4dD4KICAgICAgICA8L2c+CiAgICA8L2c+Cjwvc3ZnPgo=';
    private static logo_dark = 'data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiIHN0YW5kYWxvbmU9Im5vIj8+CjwhRE9DVFlQRSBzdmcgUFVCTElDICItLy9XM0MvL0RURCBTVkcgMS4xLy9FTiIgImh0dHA6Ly93d3cudzMub3JnL0dyYXBoaWNzL1NWRy8xLjEvRFREL3N2ZzExLmR0ZCI+Cjxzdmcgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgdmlld0JveD0iMCAwIDc1MiAzMzAiIHZlcnNpb249IjEuMSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB4bWxuczp4bGluaz0iaHR0cDovL3d3dy53My5vcmcvMTk5OS94bGluayIgeG1sOnNwYWNlPSJwcmVzZXJ2ZSIgeG1sbnM6c2VyaWY9Imh0dHA6Ly93d3cuc2VyaWYuY29tLyIgc3R5bGU9ImZpbGwtcnVsZTpldmVub2RkO2NsaXAtcnVsZTpldmVub2RkO3N0cm9rZS1saW5lY2FwOnJvdW5kO3N0cm9rZS1saW5lam9pbjpyb3VuZDtzdHJva2UtbWl0ZXJsaW1pdDoxLjU7Ij4KICAgIDxnIGlkPSJBcnRib2FyZDEiIHRyYW5zZm9ybT0ibWF0cml4KDAuOTc4Mzg5LDAsMCwwLjk4Mjk4MSwtMTguODQ3NiwtMTI4LjcxNikiPgogICAgICAgIDxyZWN0IHg9IjE5LjI2NCIgeT0iMTMwLjk0NSIgd2lkdGg9Ijc2OC40ODkiIGhlaWdodD0iMzM1LjAzMyIgc3R5bGU9ImZpbGw6bm9uZTsiLz4KICAgICAgICA8ZyB0cmFuc2Zvcm09Im1hdHJpeCgxLjAyMjA5LDAsMCwxLjAxNzMxLC0xNy4xMzAxLC03LjEwNjY5KSI+CiAgICAgICAgICAgIDxnIHRyYW5zZm9ybT0ibWF0cml4KDAuNDcwMjUzLDAsMCwwLjQ3MDI1MywtNS44NjQxOSw2Mi42NDYzKSI+CiAgICAgICAgICAgICAgICA8Y2lyY2xlIGN4PSI0NjEuNDUzIiBjeT0iNTEyLjA0MiIgcj0iMjc4LjA4MSIgc3R5bGU9ImZpbGw6cmdiKDQyLDQyLDQyKTtzdHJva2U6d2hpdGU7c3Ryb2tlLXdpZHRoOjkuNTdweDsiLz4KICAgICAgICAgICAgPC9nPgoKICAgICAgICAgICAgPGcgdHJhbnNmb3JtPSJtYXRyaXgoMi42NjkyNiwwLC0xLjg1OTk5ZS0xNiwyLjgwNDE1LC04MzMuNjM4LC0xNDUwLjA1KSI+CiAgICAgICAgICAgICAgICA8ZWxsaXBzZSBjeD0iMzgyLjAyOSIgY3k9IjYzMi44MzQiIHJ4PSIxNi4xNDciIHJ5PSIxNS4zNTciIHN0eWxlPSJmaWxsOnJnYig0MiwxNzAsMjE1KTsiLz4KICAgICAgICAgICAgPC9nPgoKICAgICAgICAgICAgPGcgdHJhbnNmb3JtPSJtYXRyaXgoMi42NjkyNiwwLC0xLjg1OTk5ZS0xNiwyLjgwNDE1LC03NzcuNzgxLC0xNDQ5Ljc0KSI+CiAgICAgICAgICAgICAgICA8ZWxsaXBzZSBjeD0iMzgyLjAyOSIgY3k9IjYzMi44MzQiIHJ4PSIxNi4xNDciIHJ5PSIxNS4zNTciIHN0eWxlPSJmaWxsOnJnYigyNTUsMCw4OSk7Ii8+CiAgICAgICAgICAgIDwvZz4KICAgICAgICAgICAgPGcgdHJhbnNmb3JtPSJtYXRyaXgoMy4zNTA2NywwLDAsMy4zNTA2NywtMTQ0MS40MSwtMTc4MC43OSkiPgogICAgICAgICAgICAgICAgPHBhdGggZD0iTTQ5NC4xMTQsNjE4LjU4NEM0OTYuODUzLDYyMC45NDIgNDk4LjU4OSw2MjQuNDMyIDQ5OC41ODksNjI4LjMyNEM0OTguNTg5LDYzMi4yNjcgNDk2LjgwNyw2MzUuNzk4IDQ5NC4wMDYsNjM4LjE1NUM0OTEuMjY3LDYzNS43OTggNDg5LjUzMiw2MzIuMzA4IDQ4OS41MzIsNjI4LjQxNkM0ODkuNTMyLDYyNC40NzMgNDkxLjMxMyw2MjAuOTQyIDQ5NC4xMTQsNjE4LjU4NFoiIHN0eWxlPSJmaWxsOnJnYigxOTUsMTMyLDIwMyk7Ii8+CiAgICAgICAgICAgIDwvZz4KCiAgICAgICAgPC9nPgogICAgICAgIDxnIHRyYW5zZm9ybT0ibWF0cml4KDIuNzI4MjIsMCwtMS45MDEwN2UtMTYsMi44NTI3LC04NDMuMDAyLC0xNTI4LjYyKSI+CiAgICAgICAgICAgIDxlbGxpcHNlIGN4PSIzODIuMDI5IiBjeT0iNjMyLjgzNCIgcng9IjE2LjE0NyIgcnk9IjE1LjM1NyIgc3R5bGU9ImZpbGw6d2hpdGU7Ii8+CiAgICAgICAgPC9nPgogICAgICAgIDxnIHRyYW5zZm9ybT0ibWF0cml4KDMuNDI0NjgsMCwwLDMuNDA4NjgsLTE0OTAuMzgsLTE4MTguNzMpIj4KICAgICAgICAgICAgPHBhdGggZD0iTTQ4OS42MDgsNjI3LjAxNkM0OTAuMzA3LDYyMC41OCA0OTUuNzcsNjE1LjU2NCA1MDIuMzk2LDYxNS41NjRDNTAzLjcwNCw2MTUuNTY0IDUwNC45NjcsNjE1Ljc2IDUwNi4xNTcsNjE2LjEyM0M1MDUuNDU4LDYyMi41NTkgNDk5Ljk5NSw2MjcuNTc1IDQ5My4zNjksNjI3LjU3NUM0OTIuMDYxLDYyNy41NzUgNDkwLjc5OCw2MjcuMzc5IDQ4OS42MDgsNjI3LjAxNloiIHN0eWxlPSJmaWxsOnJnYigyMzgsMTMzLDE3MCk7Ii8+CiAgICAgICAgPC9nPgogICAgICAgIDxnIHRyYW5zZm9ybT0ibWF0cml4KDMuNDI0NjgsMCwwLDMuNDA4NjgsLTE0OTAuMzgsLTE4MTguNzMpIj4KICAgICAgICAgICAgPHBhdGggZD0iTTQ4MC42MzEsNjE2LjUyMUM0ODIuMTk0LDYxNS44NDYgNDgzLjkxNiw2MTUuNDcyIDQ4NS43MjUsNjE1LjQ3MkM0OTIuMjE0LDYxNS40NzIgNDk3LjU4Nyw2MjAuMjgzIDQ5OC40NjQsNjI2LjUyNkM0OTYuOTAxLDYyNy4yMDEgNDk1LjE3OCw2MjcuNTc1IDQ5My4zNjksNjI3LjU3NUM0ODYuODgsNjI3LjU3NSA0ODEuNTA3LDYyMi43NjQgNDgwLjYzMSw2MTYuNTIxWiIgc3R5bGU9ImZpbGw6cmdiKDE1OSwyMzAsMjU1KTsiLz4KICAgICAgICA8L2c+CiAgICAgICAgPGcgdHJhbnNmb3JtPSJtYXRyaXgoMy40MjQ2OCwwLDAsMy40MDg2OCwtMTQ5MC4zOCwtMTgxOC43MykiPgogICAgICAgICAgICA8cGF0aCBkPSJNNDk0LjExNCw2MTguNTg0QzQ5Ni40MjQsNjIwLjU3MiA0OTguMDIsNjIzLjM2NiA0OTguNDY0LDYyNi41MjZDNDk2LjkwMSw2MjcuMjAxIDQ5NS4xNzgsNjI3LjU3NSA0OTMuMzY5LDYyNy41NzVDNDkyLjA2MSw2MjcuNTc1IDQ5MC43OTgsNjI3LjM3OSA0ODkuNjA4LDYyNy4wMTZDNDg5Ljk3NCw2MjMuNjQzIDQ5MS42NDksNjIwLjY2IDQ5NC4xMTQsNjE4LjU4NFoiIHN0eWxlPSJmaWxsOndoaXRlOyIvPgogICAgICAgIDwvZz4KICAgICAgICA8ZyB0cmFuc2Zvcm09Im1hdHJpeCgxLjQ2MTA2LDAsMCwxLjQ1NDI0LDM3Ny40ODEsMzUzLjA5NikiPgogICAgICAgICAgICA8dGV4dCB4PSIwcHgiIHk9IjBweCIgc3R5bGU9ImZvbnQtZmFtaWx5OidBcmlhbFJvdW5kZWRNVEJvbGQnLCAnQXJpYWwgUm91bmRlZCBNVCBCb2xkJywgc2Fucy1zZXJpZjtmb250LXNpemU6MTE0LjE2N3B4O2ZpbGw6d2hpdGU7Ij51bnl0PC90ZXh0PgogICAgICAgIDwvZz4KICAgIDwvZz4KCjwvc3ZnPgo=';

    // TODO add colored logo dark - light mode
    public static logStatus(data:any){

        logger.plain `#image(100,'unyt')${console_theme == "dark" ? this.logo_dark : this.logo_light}
   Connected to the supranet via #color(green)[${data.node.toString()}] (${data.type})
  
   #color(grey)[MODE]      ${data.mode}
   #color(grey)[APP]       ${data.app||'-'}
   #color(grey)[LICENSE]   ${data.license}
   #color(grey)[ENDPOINT]  #color(green)[${data.endpoint}]

   Worbench Access for this Endpoint: https://workbench2.unyt.org/\?e=${data.endpoint}
   #color(grey)© ${new Date().getFullYear().toString()} unyt.org
  `;

    }


}


@scope @to('@+unyt.auth') class Auth {
    @remote static get_private_keys(endpoint: Endpoint, hash: ArrayBuffer): Promise<[ArrayBuffer, ArrayBuffer, ArrayBuffer, ArrayBuffer]> {return null}
    @remote static set_private_keys(endpoint: Endpoint, hash: ArrayBuffer, sign_key: ArrayBuffer, dec_key: ArrayBuffer, iv_sign: ArrayBuffer, iv_dec: ArrayBuffer): Promise<boolean> {return null}
}

globalThis.Unyt = Unyt