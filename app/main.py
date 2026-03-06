from fastapi import FastAPI

from app.routers import problems, attempts

app = FastAPI(title="PrepOS")

app.include_router(problems.router)
app.include_router(attempts.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
