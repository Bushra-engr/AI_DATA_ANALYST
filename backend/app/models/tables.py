from sqlalchemy import String,Column,Integer,DateTime,Text,ForeignKey,BigInteger,JSON
from app.models.connection import Base
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)

    name = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )

    # Relationships
    datasets = relationship(
        "Dataset",
        back_populates="user",
        cascade="all, delete-orphan"
    )

    chats = relationship(
        "Chat",
        back_populates="user",
        cascade="all, delete-orphan"
    )

class Dataset(Base):
    __tablename__ = "datasets"

    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    name = Column(String(255), nullable=False)
    
    
    file_type = Column(String(20), nullable=False)

    row_count = Column(BigInteger, nullable=True)
    column_count = Column(Integer, nullable=True)

    status = Column(
        String(50),
        nullable=False
    )

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )

    # Relationships
    user = relationship(
        "User",
        back_populates="datasets"
    )

    analysis = relationship(
        "Analysis",
        back_populates="dataset",
        uselist=False,
        cascade="all, delete-orphan"
    )

    chats = relationship(
        "Chat",
        back_populates="dataset",
        cascade="all, delete-orphan"
    )

class Analysis(Base):
    __tablename__ = "analyses"

    id = Column(Integer, primary_key=True, index=True)

    dataset_id = Column(
        Integer,
        ForeignKey("datasets.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True
    )

    # Dataset structure / profiling
    profile = Column(JSON, nullable=True)

    # Missing values, duplicates, outliers, etc.
    quality = Column(JSON, nullable=True)

    # Calculated statistical results
    statistics = Column(JSON, nullable=True)

    # Top AI/analytical findings
    insights = Column(JSON, nullable=True)

    # Information required by frontend to build dashboard
    dashboard_config = Column(JSON, nullable=True)

    # Human-readable AI summary
    summary = Column(Text, nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )

    dataset = relationship(
        "Dataset",
        back_populates="analysis"
    )

class Chat(Base):
    __tablename__ = "chats"

    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    dataset_id = Column(
        Integer,
        ForeignKey("datasets.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    question = Column(Text, nullable=False)

    answer = Column(Text, nullable=True)

    # Example: "sql", "python", "rag"
    tool_used = Column(String(50), nullable=True)

    # Filled only when Text-to-SQL is used
    sql_query = Column(Text, nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )

    # Relationships
    user = relationship(
        "User",
        back_populates="chats"
    )

    dataset = relationship(
        "Dataset",
        back_populates="chats"
    )