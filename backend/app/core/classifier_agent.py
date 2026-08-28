from langchain_core.prompts import ChatPromptTemplate
from app.core.llm_provider import llm
from langchain_core.output_parsers import StrOutputParser
from app.core.state import State

def RouterAgent(state: State) -> dict:
    """
    Routes dataset questions to sql, insight, or direct.
    """

    prompt = ChatPromptTemplate.from_messages([
        ("system", """
You are a Question Router for a data analytics platform.

Classify the user's question into EXACTLY ONE category:

"sql"
- Requires querying or calculating from actual dataset rows.
- Use for counts, sums, averages, filters, sorting, grouping, top/bottom values, or row-level values.
- Examples:
  "how many rows?"
  "what is the average sales?"
  "show customers from India"
  "what are the top 5 products?"

"insight"
- Requires analysis or interpretation of the dataset.
- Use for patterns, trends, anomalies, relationships, findings, or overall analytical conclusions.
- Examples:
  "what patterns do you see?"
  "what are the key findings?"
  "are there any anomalies?"
  "what insights can you find?"

"direct"
- Use for general conversational inquiries, explanations in plain text, summaries, descriptions, schema, platform guide, or any question asking to explain in words without needing direct row SQL calculations.
- Examples:
  "explain this dataset"
  "tell me in text"
  "what is this dataset about?"
  "what can you do?"
  "summarize this data"
  "what are the columns?"
  "what are the features?"
  "list all fields"
  "what data types are present?"
  "how many columns are there?"
  "are there missing values?"

IMPORTANT ROUTING RULES:

1. Normal conversational questions, explanations, guides, or summary requests → "direct".
2. Questions asking for columns/features/schema/quality → "direct".
3. Questions strictly requiring aggregate calculations, math on rows, counts, sums, or group-bys → "sql".
4. Questions asking for trends, correlations, anomalies, predictions, ML, or business use cases → "insight".
5. Default to "direct" for any normal or ambiguous query.

Dataset Schema:
{schema}

Return ONLY ONE WORD:
sql
insight
or
direct
"""),
        ("human", "Question: {question}")
    ])

    chain = prompt | llm | StrOutputParser()

    tool_choice = "direct"
    try:
        raw = chain.invoke({
            "question": state["question"],
            "schema": str(state.get("schema", {})),
        })
        tool_choice = raw.strip().lower()
    except Exception as e:
        print(f"[RouterAgent Fallback] LLM routing notice: {e}")
        q = (state.get("question") or "").lower()
        if any(w in q for w in ["how many", "average", "avg", "sum", "total", "count", "maximum", "max", "minimum", "min", "highest", "lowest", "top", "bottom", "filter", "where", "group by", "calculate"]):
            tool_choice = "sql"
        elif any(w in q for w in ["pattern", "trend", "insight", "anomaly", "anomalies", "outlier", "correlation", "recommend", "business", "finding"]):
            tool_choice = "insight"
        else:
            tool_choice = "direct"

    if tool_choice not in ("sql", "insight", "direct"):
        tool_choice = "direct"

    return {"tool_choice": tool_choice}