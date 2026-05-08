# Version: 1.0.2 - Fixed /docs conflict
from fastapi import FastAPI, UploadFile, File, HTTPException, Query, Request
import shutil
import os
import asyncio
from typing import Optional, List
import uvicorn
import json
from pageindex import page_index_main
from pageindex.utils import ConfigLoader

# 彻底禁用内置文档，防止 /docs 冲突
app = FastAPI(title="PageIndex Local API", docs_url=None, redoc_url=None)

# 临时文件存储目录
UPLOAD_DIR = "/tmp/pageindex_uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# 持久化目录
OUTPUT_DIR = "/app/output"
os.makedirs(OUTPUT_DIR, exist_ok=True)
CACHE_FILE = os.path.join(OUTPUT_DIR, "results_cache.json")

# 模拟数据库存储解析结果
results_cache = {}

def load_cache():
    global results_cache
    if os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, "r") as f:
                results_cache = json.load(f)
            print(f"Loaded {len(results_cache)} documents from cache")
        except Exception as e:
            print(f"Error loading cache: {e}")

def save_cache():
    try:
        with open(CACHE_FILE, "w") as f:
            json.dump(results_cache, f)
    except Exception as e:
        print(f"Error saving cache: {e}")

@app.on_event("startup")
async def startup_event():
    load_cache()

@app.post("/doc/")
async def submit_document(file: UploadFile = File(...)):
    print(f"Uploading document: {file.filename}")
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")
    
    file_path = os.path.join(UPLOAD_DIR, f"{os.urandom(8).hex()}-{file.filename}")
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        user_opt = {
            "if_add_node_id": "yes",
            "if_add_node_text": "yes",
            "if_add_node_summary": "yes",
            "if_add_doc_description": "yes",
            "model": "openai/deepseek-chat"
        }
        
        opt = ConfigLoader().load(user_opt)
        result = await asyncio.to_thread(page_index_main, file_path, opt)
        
        doc_id = os.path.basename(file_path)
        results_cache[doc_id] = {
            "doc_id": doc_id,
            "status": "completed",
            "result": result.get("structure", [])
        }
        save_cache()
        
        return {"doc_id": doc_id, "status": "completed"}
    except Exception as e:
        print(f"Error processing: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if os.path.exists(file_path):
            os.remove(file_path)

@app.get("/doc/{doc_id}/")
async def get_tree(doc_id: str):
    if doc_id not in results_cache:
        raise HTTPException(status_code=404, detail="Document not found")
    return results_cache[doc_id]

@app.get("/doc/{doc_id}/metadata")
async def get_metadata(doc_id: str):
    if doc_id not in results_cache:
        raise HTTPException(status_code=404, detail="Document not found")
    return {
        "id": doc_id,
        "name": doc_id.split('-', 1)[-1],
        "status": "completed",
        "created_at": "2026-05-07T00:00:00Z"
    }

@app.get("/docs")
async def list_documents(limit: int = 50, offset: int = 0):
    print(f"Listing docs: limit={limit}, offset={offset}")
    docs = []
    for doc_id in results_cache:
        docs.append({
            "id": doc_id,
            "name": doc_id.split('-', 1)[-1],
            "status": "completed"
        })
    return docs[offset : offset + limit]

@app.delete("/doc/{doc_id}/")
async def delete_document(doc_id: str):
    if doc_id in results_cache:
        del results_cache[doc_id]
        save_cache()
        return {"status": "deleted"}
    raise HTTPException(status_code=404, detail="Document not found")

@app.post("/mcp")
async def mcp_handler(request: Request):
    data = await request.json()
    method = data.get("method")
    params = data.get("params", {})
    msg_id = data.get("id")

    if method == "tools/call":
        tool_name = params.get("name")
        tool_args = params.get("arguments", {})
        
        if tool_name == "find_relevant_documents":
            query = tool_args.get("query", "").lower()
            hits = []
            for doc_id, content in results_cache.items():
                for node in content.get("result", []):
                    if query in node.get("text", "").lower() or query in node.get("title", "").lower():
                        hits.append({
                            "doc_id": doc_id,
                            "doc_name": doc_id.split('-', 1)[-1],
                            "summary": node.get("summary", "")
                        })
            return {
                "jsonrpc": "2.0",
                "id": msg_id,
                "result": {"content": [{"type": "text", "text": json.dumps(hits[:5])}]}
            }
            
        elif tool_name == "get_document_structure":
            doc_name = tool_args.get("doc_name")
            target_data = None
            for doc_id, content in results_cache.items():
                if doc_id.endswith(doc_name):
                    target_data = content
                    break
            
            return {
                "jsonrpc": "2.0",
                "id": msg_id,
                "result": {"content": [{"type": "text", "text": json.dumps(target_data.get("result", []) if target_data else [])}]}
            }

    return {"jsonrpc": "2.0", "id": msg_id, "result": {"content": []}}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=9090)
