from fastapi import FastAPI
from app.api.generate import router

app = FastAPI()
app.include_router(router)