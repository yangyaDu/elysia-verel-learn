FROM python:3.10-slim

WORKDIR /app

# 安装 git 和编译工具
RUN apt-get update && apt-get install -y git build-essential && rm -rf /var/lib/apt/lists/*

# 克隆 PageIndex 仓库
RUN git clone https://github.com/VectifyAI/PageIndex.git .

# 安装依赖
# 由于 PageIndex 可能没发 pip 包，我们直接安装它的 requirements
RUN pip install --no-cache-dir fastapi uvicorn python-multipart
RUN sed -i 's/^python-dotenv==1\.2\.2$/python-dotenv==1.0.1/' requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# 复制包装器脚本
COPY pageindex_server.py /app/pageindex_server.py

# 设置 PYTHONPATH 确保能找到 pageindex 包
ENV PYTHONPATH=/app

# 设置环境变量默认值
ENV OPENAI_API_BASE=https://api.deepseek.com/v1
ENV DEEPSEEK_API_KEY=""

EXPOSE 9090

# 使用 uvicorn 启动 FastAPI 应用
CMD ["uvicorn", "pageindex_server:app", "--host", "0.0.0.0", "--port", "9090"]
