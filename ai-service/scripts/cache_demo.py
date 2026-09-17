import asyncio
import time
from app.core.cache import cache_key, get_cached, set_cached, clear_cache, get_or_set

async def run_demo():
    clear_cache()
    print("=" * 60)
    print("      INTERNOPS AI SERVICE — IN-MEMORY TTL CACHE DEMO      ")
    print("=" * 60)

    prompt = "Explain quantum computing in one sentence."
    provider = "gemini"
    model = "gemini-2.0-flash"
    temperature = 0.7

    key = cache_key(provider, model, prompt, temperature)
    print(f"\n[CONFIG] TTL: 3 seconds | Key: {key}")

    provider_calls = 0

    async def mock_llm_call():
        nonlocal provider_calls
        provider_calls += 1
        print(f"  --> [UPSTREAM LLM CALL #{provider_calls}] Invoking provider '{provider}' ({model})...")
        await asyncio.sleep(0.1) # simulate latency
        return f"Quantum computing harnesses quantum mechanics to process complex data exponentially faster."

    # -------------------------------------------------------------
    # SCENARIO 1: First Request -> Cache MISS
    # -------------------------------------------------------------
    print("\n--- [SCENARIO 1] First Request (Cache MISS) ---")
    start = time.time()
    res1, cached1 = await get_or_set(key, mock_llm_call, ttl=3)
    duration1 = (time.time() - start) * 1000
    print(f"  Result: '{res1}'")
    print(f"  Cached: {cached1} | Latency: {duration1:.2f}ms | Total LLM Calls: {provider_calls}")
    assert cached1 is False
    assert provider_calls == 1

    # -------------------------------------------------------------
    # SCENARIO 2: Identical Request -> Cache HIT
    # -------------------------------------------------------------
    print("\n--- [SCENARIO 2] Identical Request within TTL (Cache HIT) ---")
    start = time.time()
    res2, cached2 = await get_or_set(key, mock_llm_call, ttl=3)
    duration2 = (time.time() - start) * 1000
    print(f"  Result: '{res2}'")
    print(f"  Cached: {cached2} | Latency: {duration2:.2f}ms | Total LLM Calls: {provider_calls}")
    assert cached2 is True
    assert provider_calls == 1 # Provider call count did not increase!

    # -------------------------------------------------------------
    # SCENARIO 3: TTL Expiration -> Cache MISS
    # -------------------------------------------------------------
    print("\n--- [SCENARIO 3] Waiting for TTL Expiration (3s)... ---")
    await asyncio.sleep(3.2)
    start = time.time()
    res3, cached3 = await get_or_set(key, mock_llm_call, ttl=3)
    duration3 = (time.time() - start) * 1000
    print(f"  Result: '{res3}'")
    print(f"  Cached: {cached3} | Latency: {duration3:.2f}ms | Total LLM Calls: {provider_calls}")
    assert cached3 is False
    assert provider_calls == 2 # Provider invoked again after expiration!

    print("\n" + "=" * 60)
    print("SUCCESS: In-Memory TTL Cache behavior verified 100%!")
    print("=" * 60)

if __name__ == "__main__":
    asyncio.run(run_demo())
