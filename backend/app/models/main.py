from app.models.connection import Base,engine
import app.models.tables as tables

Base.metadata.create_all(bind=engine)
print("DB created succesfully!")