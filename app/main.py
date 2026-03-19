from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.routers import analytics, attempts, problems, recommender

app = FastAPI(title="PrepOS")

app.include_router(problems.router)
app.include_router(attempts.router)
app.include_router(analytics.router)
app.include_router(recommender.router)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(_request, exc: RequestValidationError):
    errors = [
        {"field": ".".join(str(loc) for loc in e["loc"][1:]), "message": e["msg"]}
        for e in exc.errors()
    ]
    return JSONResponse(
        status_code=422,
        content={"detail": "Validation error", "errors": errors},
    )


@app.get("/health")
async def health():
    return {"status": "ok"}
