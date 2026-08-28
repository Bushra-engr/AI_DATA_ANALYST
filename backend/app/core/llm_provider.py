import os
from pathlib import Path
from dotenv import load_dotenv

env_path_backend = Path(__file__).resolve().parents[2] / ".env"
env_path_root = Path(__file__).resolve().parents[3] / ".env"

if env_path_backend.exists():
    load_dotenv(dotenv_path=env_path_backend)
elif env_path_root.exists():
    load_dotenv(dotenv_path=env_path_root)
else:
    load_dotenv()

groq_api_key = os.getenv("GROQ_API_KEY")
groq_model = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")

llm = None
try:
    if groq_api_key:
        from langchain_groq import ChatGroq
        llm = ChatGroq(
            model=groq_model,
            temperature=0.0,
            api_key=groq_api_key
        )
except Exception as e:
    print(f"LLM Provider initialization notice (fallback active): {e}")

