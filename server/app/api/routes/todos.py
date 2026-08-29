import asyncio
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from app.db import SqlClient, get_firestore

from app.core.auth import get_current_user
from app.core.cache import CACHE_TTL_MEDIUM, CACHE_TTL_SHORT, cache_invalidate_prefix, cached
from app.core.sync import broadcast_data_change
from app.repositories import todos

from app.schemas.todo import TodoCreate, TodoResponse, TodoUpdate

router = APIRouter(prefix="/todos")

_TODOS_PREFIX = "todos"


def _invalidate_todos(user_id: str) -> None:
    cache_invalidate_prefix(f"{_TODOS_PREFIX}:{user_id}")


@router.get("")
@cached(ttl=CACHE_TTL_SHORT, prefix=_TODOS_PREFIX)
async def list_todos(
    cursor: str | None = None,
    limit: int | None = Query(default=None, ge=1, le=50),
    database: SqlClient = Depends(get_firestore),
    user: dict = Depends(get_current_user),
):
    # Paginated when cursor/limit supplied; legacy list capped to 100 otherwise for e2-micro safety
    if cursor is not None or limit is not None:
        eff_limit = limit or 20
        items, next_cursor, has_more = await asyncio.to_thread(todos.list_todos_page, database, user["uid"], cursor, eff_limit)
        return {"items": items, "next_cursor": next_cursor, "has_more": has_more}
    result = await asyncio.to_thread(todos.list_todos, database, user["uid"])
    # Back-compat: frontend expects list; return list directly when no pagination
    return result


@router.get("/{todo_id}", response_model=TodoResponse)
@cached(ttl=CACHE_TTL_MEDIUM, prefix=_TODOS_PREFIX)
async def get_todo(
    todo_id: str,
    database: SqlClient = Depends(get_firestore),
    user: dict = Depends(get_current_user),
):
    todo = await asyncio.to_thread(todos.get_todo, database, user["uid"], todo_id)
    if todo is None:
        raise HTTPException(status_code=404, detail="Todo not found.")
    return todo


@router.post("", response_model=TodoResponse, status_code=status.HTTP_201_CREATED)
async def create_todo(
    todo: TodoCreate,
    database: SqlClient = Depends(get_firestore),
    user: dict = Depends(get_current_user),
):
    result = await asyncio.to_thread(todos.create_todo, database, user["uid"], todo)
    _invalidate_todos(user["uid"])
    await broadcast_data_change(user["uid"], "todos", "create", result.get("id") if isinstance(result, dict) else None)
    return result


@router.patch("/{todo_id}", response_model=TodoResponse)
async def update_todo(
    todo_id: str,
    changes: TodoUpdate,
    database: SqlClient = Depends(get_firestore),
    user: dict = Depends(get_current_user),
):
    todo = await asyncio.to_thread(todos.update_todo, database, user["uid"], todo_id, changes)
    if todo is None:
        raise HTTPException(status_code=404, detail="Todo not found.")
    _invalidate_todos(user["uid"])
    await broadcast_data_change(user["uid"], "todos", "update", todo_id)
    return todo


@router.delete("/{todo_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_todo(
    todo_id: str,
    database: SqlClient = Depends(get_firestore),
    user: dict = Depends(get_current_user),
):
    ok = await asyncio.to_thread(todos.delete_todo, database, user["uid"], todo_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Todo not found.")
    _invalidate_todos(user["uid"])
    await broadcast_data_change(user["uid"], "todos", "delete", todo_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{todo_id}/restore", response_model=TodoResponse)
async def restore_todo(
    todo_id: str,
    database: SqlClient = Depends(get_firestore),
    user: dict = Depends(get_current_user),
):
    ok = await asyncio.to_thread(todos.restore_todo, database, user["uid"], todo_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Todo not found.")
    todo = await asyncio.to_thread(todos.get_todo, database, user["uid"], todo_id)
    if todo is None:
        raise HTTPException(status_code=404, detail="Todo not found.")
    _invalidate_todos(user["uid"])
    await broadcast_data_change(user["uid"], "todos", "restore", todo_id)
    return todo
