from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from app.core.llm_provider import llm
from app.core.state import State
from app.models.connection import SessionLocal
from app.models.tables import Analysis


def DirectAgent(state: State) -> dict:
    """
    Simple direct LLM answer — no tool needed. But use this to ans basic queries from dataset like about?features etc . basic stats ,etc.
    """
    dataset_id = state.get("dataset_id")
    profile = {}
    quality = {}
    stats = {}
    
    with SessionLocal() as session:
        analyses = session.query(Analysis).filter(Analysis.dataset_id==dataset_id).first() if dataset_id else None
        if analyses:
            profile = analyses.profile or {}
            quality = analyses.quality or {}
            stats = analyses.statistics or {}

    prompt = ChatPromptTemplate.from_messages([
        ("system", """
You are a **Data Analyst Assistant**. Answer user questions about the provided dataset clearly, accurately, and concisely.

Use the available dataset context appropriately:

* **Profile:** `{data_profile}` — understand columns, data types, features, distributions, and dataset structure.
* **Statistics:** `{stats}` — answer basic statistical questions such as count, mean, median, min/max, ranges, and other available metrics.
* **Quality:** `{quality}` — identify missing values, duplicates, inconsistencies, outliers, or other data-quality issues when relevant.

For each question:
1. Identify which context is relevant.
2. Use the provided information rather than guessing.
3. Combine Profile, Statistics, and Quality when needed.
4. If the requested information is unavailable, clearly say so.
5. Answer concisely in clean Markdown tables and bullet points.
"""),
        ("human", "{question}")
    ])
 
    try:
        chain = prompt | llm | StrOutputParser()
        answer = chain.invoke({
            "question": state["question"],
            "data_profile": profile,
            "quality": quality,
            "stats": stats
        })
    except Exception as e:
        print(f"[DirectAgent Fallback]: {e}")
        cols = profile.get("columns", [])
        total_rows = profile.get("total_rows", 0)
        total_cols = profile.get("total_columns", len(cols))
        q_score = quality.get("quality_score", 95.0)
        
        answer = f"### 📊 Dataset Overview\n\n"
        answer += f"- **Total Rows**: `{total_rows:,}`\n"
        answer += f"- **Total Columns**: `{total_cols}`\n"
        answer += f"- **Data Quality Score**: `{q_score}%`\n\n"
        if cols:
            answer += "#### 📋 Columns & Data Types\n\n| Column | Data Type | Semantic Type |\n|---|---|---|\n"
            for c in cols[:15]:
                answer += f"| {c.get('name')} | `{c.get('dtype')}` | `{c.get('semantic_type', 'feature')}` |\n"
 
    return {"answer": answer}