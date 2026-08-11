from app.services.account_token_service import token_hash
def test_token_hash_is_deterministic_and_does_not_reveal_raw_token():
    raw="activation-secret-value";hashed=token_hash(raw)
    assert len(hashed)==64 and hashed==token_hash(raw) and raw not in hashed
