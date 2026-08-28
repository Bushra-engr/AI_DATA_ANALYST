from fastapi import APIRouter,HTTPException,status
from app.services.auth_service import register_user,authenticate_user
from app.services.security import create_access_token
from app.schemas.auth import UserLogin,UserRegister


router = APIRouter(
    prefix="/auth",
    tags=["auth"]
)


@router.post("/register")
def userRegister(user_data:UserRegister):
    response = register_user(user_data)
    
    if response["success"]==True:
        return response
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail = response["message"]
        )
        

@router.post("/login")
def user_login(user_data:UserLogin):
    response = authenticate_user(user_data)
    
    if response["success"]==True:
        user_id = response["user_id"]
        generated_token = create_access_token(user_id)
        return {
            "access_token":generated_token,
            "token_type":"bearer"
        }
        
    else:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail = response["message"]
        )