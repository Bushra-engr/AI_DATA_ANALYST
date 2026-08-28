from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser
from app.core.llm_provider import llm 
from app.core.state import State
from fastapi import HTTPException,status
from app.models.connection import SessionLocal
from app.models.tables import Analysis
from typing import List, Dict, Any 

def InsightAgent(state:State):
    dataset_id =int(state["dataset_id"])
    try:
       with SessionLocal() as session:
            analysis_record = session.query(Analysis).filter(dataset_id==Analysis.dataset_id).first()
           
            if not analysis_record:
               return {
                   "tool_result":"NO insights found for this dataset!"
               }
            raw_insights = analysis_record.insights
    except Exception as e:
        return {
            "tool_result":e
        }
        
    prompt = ChatPromptTemplate.from_messages(
         messages=[
                ("system","""
                 You are an Insight Filtering Assistant.
        Your job is to look at a list of raw dataset insights and extract the top 5 insights relevant to the user's question.

        CRITICAL RULES:
        1. Return ONLY a valid JSON array containing up to 5 matching insights.
        2. Do not add markdown code blocks (like ```json), no conversation, no explanations.
        3. If no insights match, return an empty JSON list [].

        Available Raw Insights:
        {raw_insights}"""),
        ("human", "User Question: {question}")
    ])
    
    try:
        chain = prompt | llm | JsonOutputParser()
        filtered_insights = chain.invoke({
            "raw_insights": str(raw_insights),
            "question": state["question"]
        })
        top_5_insights = filtered_insights[:5] if isinstance(filtered_insights, list) else []
    except Exception as e:
        print(f"[InsightAgent Fallback]: {e}")
        top_5_insights = raw_insights[:5] if isinstance(raw_insights, list) else []

    state["tool_result"] = top_5_insights
    return state

                
            