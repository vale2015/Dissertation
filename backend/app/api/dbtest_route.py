from flask import Blueprint
from app.controllers.dbtest_controller import health, health_db, get_columns

testdb_bp = Blueprint("dbtest", __name__)

@testdb_bp.get("/")
def dbtest_health_route():
    return health()

@testdb_bp.get("/db")
def dbtest_database_route():
    return health_db()

@testdb_bp.get("/columns")
def dbtest_columns_route():
    return get_columns()
    