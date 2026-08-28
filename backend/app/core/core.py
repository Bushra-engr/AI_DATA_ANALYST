from langgraph.graph import StateGraph, START, END
from app.core.state import State
from app.core.classifier_agent import RouterAgent
from app.core.sql_agent import SqlAgent
from app.core.insight_agent import InsightAgent
from app.core.narrator_agent import AnswerNarrator
from app.core.direct_agent import DirectAgent


def route_decision(state:State)->str:
    """
    Return the name of the next node based on tool_choice,langgraph uses this return value
    """
    tool = state.get("tool_choice","direct")
    if isinstance(tool,tuple):
        tool = tool[-1]
    if tool not in ("sql","insight","direct"):
        tool = "direct"
    return tool
        
    
def builder_graph(state:State):
    
    builder = StateGraph(state)
    
    builder.add_node("router",RouterAgent)
    builder.add_node("sql",SqlAgent)
    builder.add_node("insight",InsightAgent)
    builder.add_node("narrator",AnswerNarrator)    
    builder.add_node("direct",DirectAgent)
    
    builder.add_edge(START,"router")
    builder.add_conditional_edges(
        "router",route_decision,
        {
            "sql":"sql",
            "insight":"insight",
            "direct":"direct"
        }
    )
    
    builder.add_edge("sql","narrator")
    builder.add_edge("insight","narrator")
    builder.add_edge("direct",END)
    
    builder.add_edge("narrator",END)
    
    return builder.compile()

graph = builder_graph(State)