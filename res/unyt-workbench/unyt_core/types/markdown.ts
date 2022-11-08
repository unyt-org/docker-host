import "../lib/marked.js"; // required for Markdown highlighting
declare const marked:Function;

/** <std:Markdown> */
export class Markdown {
    content:string
    constructor(content?:string) {
        this.content = content;
    }
    toString(){
        return this.content;
    }

    private static code_colorizer:globalThis.Function
    static setCodeColorizer(code_colorizer:globalThis.Function){
        this.code_colorizer = code_colorizer;
    }

    // return formatted HTML for markdown
    async getHTML(){

        let code = document.createElement("code");
        code.style.paddingLeft = "10px";
        code.style.paddingRight = "10px";
        code.style.marginTop = "10px";
        code.style.marginBottom = "10px";
        code.innerHTML = marked(this.content);
        
        // higlight code
        if (Markdown.code_colorizer) {
            code.querySelectorAll("code").forEach(async c=>{
                let lang = c.getAttribute("class")?.replace("language-", "") || "datex";
                if (lang) {
                    c.innerHTML = await Markdown.code_colorizer(c.innerText, lang)
                }
            })
        }

        return code;
    }
}

