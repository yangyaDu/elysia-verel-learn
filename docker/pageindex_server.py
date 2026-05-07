from fastapi import FastAPI, UploadFile, File, HTTPException
import shutil
import os
import asyncio
from typing import Optional
import uvicorn
from pageindex import page_index_main
from pageindex.utils import ConfigLoader

app = FastAPI(title="PageIndex Local API")

# 临时文件存储目录
UPLOAD_DIR = "/tmp/pageindex_uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@app.post("/submit-document")
async def submit_document(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")
    
    file_path = os.path.join(UPLOAD_DIR, file.filename)
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # 模拟 CLI 参数
        opt = ConfigLoader().load({
            "pdf_path": file_path,
            "if_add_node_id": "yes",
            "if_add_text": "yes",
            "if_add_summary": "yes",
            "if_add_doc_description": "yes"
        })
        
        # 调用 PageIndex 核心逻辑
        # 注意：page_index_main 内部会调用 asyncio.run，
        # 在已经运行的 event loop 中直接调用可能会冲突。
        # 这里我们使用线程池或者简单的同步调用（如果允许）
        result = await asyncio.to_thread(page_index_main, file_path, opt)
        
        # 转换格式以适配原有的 API 响应（doc_id 模拟）
        return {
            "doc_id": file.filename, # 简单起见，使用文件名作为 ID
            "status": "completed",
            "result": result.get("structure", [])
        }
    except Exception as e:
        print(f"Error processing document: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        # 清理临时文件
        if os.path.exists(file_path):
            os.remove(file_path)

@app.get("/get-tree/{doc_id}")
async def get_tree(doc_id: str):
    # 本地版通常是即时生成的，这里仅作兼容
    return {"doc_id": doc_id, "status": "not_supported_on_local_sync"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
