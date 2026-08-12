import pytest
from app.services.staff_validation_service import *
def test_invitation_normalizes_identity():
    result=validate_invitation({"full_name":"  Sam Cook ","email":" SAM@EXAMPLE.COM ","application_role":"staff","staff_role_id":"2"})
    assert result=={"full_name":"Sam Cook","email":"sam@example.com","application_role":"staff","staff_role_id":2}
def test_staff_requires_operational_role():
    with pytest.raises(StaffValidationError) as error:validate_invitation({"full_name":"Sam Cook","email":"sam@example.com","application_role":"staff"})
    assert "staff_role_id" in error.value.fields
def test_registration_includes_validated_password():
    result=validate_registration({"full_name":"Sam Cook","email":"sam@example.com","application_role":"staff","staff_role_id":"2","password":"a secure password","password_confirmation":"a secure password"})
    assert result["password"]=="a secure password"
@pytest.mark.parametrize("password",["short","            ","x"*129])
def test_password_policy(password):
    with pytest.raises(StaffValidationError):validate_password({"password":password,"password_confirmation":password})
def test_password_is_not_trimmed_and_must_match():
    assert validate_password({"password":" long password value ","password_confirmation":" long password value "})==" long password value "
    with pytest.raises(StaffValidationError):validate_password({"password":"long password value","password_confirmation":"different value"})
