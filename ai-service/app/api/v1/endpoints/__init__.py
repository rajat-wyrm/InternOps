from. import notice_assistant
# and
api_router.include_router(notice_assistant.router, prefix="/ai", tags=["AI"])