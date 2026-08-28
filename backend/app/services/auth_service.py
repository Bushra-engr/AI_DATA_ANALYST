from app.models.connection import SessionLocal
from app.models.tables import User
from app.schemas.auth import UserRegister, UserLogin
from dotenv import load_dotenv
from fastapi import HTTPException
import os
import bcrypt  # Passlib ki jagah direct official bcrypt use kar rahe hain

load_dotenv()

# =========================================================
# PASSWORD HASHING (Fixed: No more 72-byte fake error)
# =========================================================

def hash_password(password: str) -> str:
    # 1. Password string ko bytes mein convert karein
    password_bytes = password.encode('utf-8')
    # 2. Salt generate karke secure hash banayein
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password_bytes, salt)
    # 3. String format mein return karein database mein save karne ke liye
    return hashed.decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        # Dono strings ko bytes mein convert karke safely match karein
        return bcrypt.checkpw(
            plain_password.encode('utf-8'),
            hashed_password.encode('utf-8')
        )
    except Exception:
        return False


# =========================================================
# REGISTER
# =========================================================
def register_user(user_data: UserRegister):
    with SessionLocal() as session:
        try:
            existing_user = session.query(User).filter(
                (User.email == user_data.email) | (User.name == user_data.name)
            ).first()
                
            if existing_user:
                return {
                    "success": False,
                    "message": "Username or email already registered!"
                }
                
            hashed_pass = hash_password(user_data.password)
                
            new_user = User(
                name = user_data.name,
                email = user_data.email,
                password_hash = hashed_pass
            )
                
            session.add(new_user)
            session.commit()
                
            return {
                "success": True,
                "message": f"Successfully inserted: {new_user.name}"
            }
        except Exception as e:
            session.rollback()
            raise HTTPException(status_code=400, detail=str(e))


# =========================================================
# LOGIN
# =========================================================
def authenticate_user(user_data: UserLogin):
    with SessionLocal() as session:
        try:
            user = session.query(User).filter(
                (User.email == user_data.username_or_email) | (User.name == user_data.username_or_email)
            ).first()
            
            if not user:
                return {
                    "success": False,
                    "message": "User does not exist! Please Register First."
                }
            
            is_pass_correct = verify_password(user_data.password, user.password_hash)
            
            if not is_pass_correct:
                return {
                    "success": False,
                    "message": "Invalid Password!"
                }
            
            return {
                "success": True,
                "message": f"Welcome back {user.name}!",
                "user_id": str(user.id)
            }
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
