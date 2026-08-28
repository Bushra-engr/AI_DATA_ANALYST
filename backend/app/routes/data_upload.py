from fastapi import APIRouter, Depends, File, UploadFile, BackgroundTasks
from app.services.upload_service import data_upload
from app.services.security import decode_access_token

router = APIRouter(
    prefix="/data",
    tags=["data"]
)

@router.post("/upload")
@router.post("/datasets/upload")
async def upload_data(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    token: dict = Depends(decode_access_token),
):
    return await data_upload(file=file, token=token, background_tasks=background_tasks)
