FROM python:3.13-slim AS builder

WORKDIR /build

COPY pyproject.toml uv.lock ./

RUN pip install --no-cache-dir uv \
    && uv export --frozen --no-dev --no-emit-project --format requirements.txt --output-file requirements.txt

FROM python:3.13-slim

WORKDIR /app

COPY --from=builder /build/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir --disable-pip-version-check -r requirements.txt \
    && useradd --create-home --uid 10001 appuser \
    && rm requirements.txt

COPY app ./app

USER appuser

EXPOSE 8000

CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]