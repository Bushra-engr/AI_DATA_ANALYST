from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from app.core.llm_provider import llm 
from app.core.state import State
from app.models.connection import SessionLocal
from fastapi import HTTPException
from app.services.duckdb_service import DuckDBService

def SqlAgent(state:State):
    duck_db =DuckDBService()
    table_name = duck_db.get_table_name(state["dataset_id"])
    prompt = ChatPromptTemplate.from_messages(
        messages=[
          ("system", """
You are a Text-to-SQL Agent.
Convert the user's natural language question into a valid DuckDB SQL query.

STRICT RULES:
1. Return ONLY the SQL query — no explanation, no markdown, no code blocks.
2. Query must be a SELECT statement only. No INSERT, UPDATE, DELETE, DROP.
3. Use the exact table name and column names provided in the schema.
4. IMPORTANT: For column names with spaces, always use DOUBLE QUOTES — never backticks.
   Example: SELECT "First Name", "Last Name" FROM dataset_1
   WRONG: SELECT `First Name` FROM dataset_1
5. Make the query DuckDB-compatible — DuckDB uses double quotes for identifiers.
6. If the question cannot be answered with SQL, return: SELECT 'NOT_APPLICABLE'
"""),
            ('human',"""
             USER QUERY:
             {user_query}
             
             Dataset Schmea:
             {schema}
             
             table_name:
             {table_name}
             
             """)
        ]
    )
    
    
    
    chain = prompt | llm | StrOutputParser()
    
    try:
        response = chain.invoke(
            {
                "user_query": state['question'],
                "schema": state.get('schema', {}),
                "table_name": table_name
            }
        )
        sql_query = (
            response
            .replace("```sql", "")
            .replace("```", "")
            .replace("`", '"')
            .strip()
        )
    except Exception as e:
        print(f"[SQLAgent LLM Fallback]: {e}")
        sql_query = f"SELECT * FROM {table_name} LIMIT 10"

    try:
        query_result = duck_db.execute_query(sql_query)
        state["tool_result"] = query_result
        state["sql_query"] = sql_query
    except Exception as e:
        print(f"[SQL Execution Error]: {e}")
        try:
            fallback_result = duck_db.execute_query(f"SELECT * FROM {table_name} LIMIT 5")
            state["tool_result"] = fallback_result
            state["sql_query"] = f"SELECT * FROM {table_name} LIMIT 5"
        except Exception:
            state["tool_result"] = {"error": str(e)}

    return state