
const http = require("http");
const fs = require("fs");
const path = require("path");
const https = require("https");

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.YOUTUBE_API_KEY;

function send(res, code, type, data){
    res.writeHead(code,{
        "Content-Type":type,
        "Cache-Control":"no-store"
    });
    res.end(data);
}

function searchYouTube(query, callback){

    const url =
        "https://www.googleapis.com/youtube/v3/search" +
        "?part=snippet&type=video&maxResults=15" +
        "&q=" + encodeURIComponent(query) +
        "&key=" + encodeURIComponent(API_KEY);

    https.get(url, function(apiRes){

        let body = "";

        apiRes.setEncoding("utf8");

        apiRes.on("data", function(chunk){
            body += chunk;
        });

        apiRes.on("end", function(){

            let data;

            try{
                data = JSON.parse(body);
            }catch(e){
                return callback("Respuesta inválida de YouTube.");
            }

            if(data.error){
                return callback(data.error.message);
            }

            const items = (data.items || []).map(function(item){

                const snippet = item.snippet || {};
                const thumbnails = snippet.thumbnails || {};

                return {
                    videoId: item.id.videoId,
                    title: snippet.title,
                    channel: snippet.channelTitle,
                    publishedAt: snippet.publishedAt,
                    thumbnail:
                        (thumbnails.medium && thumbnails.medium.url) ||
                        (thumbnails.default && thumbnails.default.url)
                };

            }).filter(function(item){
                return item.videoId;
            });

            callback(null,{items:items});
        });

    }).on("error",function(error){
        callback(error.message);
    });
}

const server = http.createServer(function(req,res){

    const parsed = new URL(req.url,"http://localhost");

    if(parsed.pathname === "/api/search"){

        if(!API_KEY){
            return send(
                res,
                503,
                "application/json; charset=utf-8",
                JSON.stringify({
                    error:"Falta configurar YOUTUBE_API_KEY en el servidor."
                })
            );
        }

        const query = (parsed.searchParams.get("q") || "").trim();

        if(!query){
            return send(
                res,
                400,
                "application/json; charset=utf-8",
                JSON.stringify({error:"Escribe qué quieres buscar."})
            );
        }

        return searchYouTube(query,function(error,data){

            if(error){
                return send(
                    res,
                    502,
                    "application/json; charset=utf-8",
                    JSON.stringify({error:error})
                );
            }

            send(
                res,
                200,
                "application/json; charset=utf-8",
                JSON.stringify(data)
            );
        });
    }

    const requested = parsed.pathname === "/" ?
        "index.html" :
        parsed.pathname.replace(/^\/+/,"");

    const root = path.resolve(__dirname);
    const file = path.resolve(root,requested);

    if(file !== path.join(root,"index.html") &&
       !file.startsWith(root + path.sep)){
        return send(res,403,"text/plain","Prohibido");
    }

    fs.readFile(file,function(error,content){

        if(error){
            return send(res,404,"text/plain","Archivo no encontrado");
        }

        const ext = path.extname(file).toLowerCase();

        const types = {
            ".html":"text/html; charset=utf-8",
            ".css":"text/css; charset=utf-8",
            ".js":"application/javascript; charset=utf-8"
        };

        send(
            res,
            200,
            types[ext] || "application/octet-stream",
            content
        );
    });
});

server.listen(PORT,"0.0.0.0",function(){
    console.log("NOVA YouTube funcionando en el puerto " + PORT);
});
