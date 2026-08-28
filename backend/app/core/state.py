from typing import TypedDict, Optional, Any, List, Dict

class State(TypedDict):
    question: str
    dataset_id: int
    schema: Any
    chat_history: Optional[List[Dict[str, Any]]]
    tool_choice: Optional[str]
    tool_result: Optional[str]
    answer: Optional[str]
    