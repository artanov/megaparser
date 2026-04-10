from sqlalchemy import (
    Column, Integer, BigInteger, String, Text, DateTime, ForeignKey, JSON, UniqueConstraint
)
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base


class TelegramSession(Base):
    __tablename__ = "telegram_sessions"

    id = Column(Integer, primary_key=True)
    phone = Column(String, nullable=False)
    session_string = Column(Text, nullable=False)
    user_id = Column(BigInteger, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class MyChannel(Base):
    __tablename__ = "my_channels"

    id = Column(Integer, primary_key=True)
    tg_id = Column(BigInteger, nullable=False)
    username = Column(String, nullable=False)
    title = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    source_channels = relationship(
        "SourceChannel", back_populates="my_channel", cascade="all, delete-orphan"
    )


class SourceChannel(Base):
    __tablename__ = "source_channels"

    id = Column(Integer, primary_key=True)
    username = Column(String, nullable=False)
    title = Column(String, nullable=False)
    tg_id = Column(BigInteger, nullable=False)
    my_channel_id = Column(Integer, ForeignKey("my_channels.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    prompt = Column(Text, nullable=True)

    my_channel = relationship("MyChannel", back_populates="source_channels")
    posts = relationship("Post", back_populates="source_channel", cascade="all, delete-orphan")


class Post(Base):
    __tablename__ = "posts"

    id = Column(Integer, primary_key=True)
    source_channel_id = Column(Integer, ForeignKey("source_channels.id"), nullable=False)
    message_id = Column(BigInteger, nullable=False)
    original_text = Column(Text, default="")
    rewritten_text = Column(Text, nullable=True)
    media_paths = Column(JSON, nullable=True)
    media_types = Column(JSON, nullable=True)
    status = Column(String, default="new")
    target_channel_id = Column(Integer, ForeignKey("my_channels.id"), nullable=True)
    sent_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    source_channel = relationship("SourceChannel", back_populates="posts")

    __table_args__ = (UniqueConstraint("source_channel_id", "message_id"),)


class PublishLog(Base):
    __tablename__ = "publish_logs"

    id = Column(Integer, primary_key=True)
    post_id = Column(Integer, ForeignKey("posts.id"), nullable=False)
    source_channel_username = Column(String, nullable=False)
    target_channel_username = Column(String, nullable=False)
    original_text_snippet = Column(String(300), nullable=False)
    rewritten_text_snippet = Column(String(300), nullable=True)
    media_count = Column(Integer, default=0)
    published_at = Column(DateTime, default=datetime.utcnow)
