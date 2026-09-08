import React from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { Clock, Pencil, Trash2, Archive, ArchiveRestore } from "lucide-react";
import { isOverdue, formatDateTime } from "@/lib/performance";
import { cn } from "@/lib/utils";

const COLUMNS = [
  { key: "Pending", label: "To Do", color: "bg-slate-200 text-slate-700" },
  { key: "In Progress", label: "In Progress", color: "bg-blue-100 text-blue-700" },
  { key: "Submitted", label: "Submitted", color: "bg-amber-100 text-amber-700" },
  { key: "Completed", label: "Done", color: "bg-emerald-100 text-emerald-700" },
];

export default function KanbanBoard({ tasks, onMoveTask, onEditTask, onArchiveTask, onDeleteTask, canEditTask, isAdmin }) {
  const onDragEnd = (result) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;
    const task = tasks.find((t) => t.id === draggableId);
    if (!task) return;
    if (destination.droppableId !== task.status) onMoveTask(task, destination.droppableId);
  };

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {COLUMNS.map((col) => {
          const colTasks = tasks.filter((t) => t.status === col.key);
          return (
            <Droppable key={col.key} droppableId={col.key}>
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={cn(
                    "bg-slate-50 rounded-xl border border-slate-200 p-3 min-h-[300px] flex flex-col transition-colors",
                    snapshot.isDraggingOver && "bg-slate-100 border-slate-300"
                  )}
                >
                  <div className="flex items-center gap-2 mb-3 px-1">
                    <span className={cn("text-xs font-semibold px-2.5 py-1 rounded-md", col.color)}>{col.label}</span>
                    <span className="text-xs text-slate-400">{colTasks.length}</span>
                  </div>
                  <div className="space-y-2 flex-1">
                    {colTasks.map((task, index) => {
                      const canEdit = canEditTask(task);
                      return (
                        <Draggable key={task.id} draggableId={task.id} index={index} isDragDisabled={!canEdit}>
                          {(prov, snap) => (
                            <div
                              ref={prov.innerRef}
                              {...prov.draggableProps}
                              {...prov.dragHandleProps}
                              className={cn(
                                "bg-white rounded-lg border border-slate-200 p-3 shadow-sm hover:shadow-md transition-shadow",
                                snap.isDragging && "shadow-lg ring-2 ring-slate-300 rotate-1",
                                !canEdit && "opacity-80 cursor-default"
                              )}
                            >
                              <h4 className="text-sm font-semibold text-slate-900 leading-snug">{task.title}</h4>
                              {task.description && (
                                <p className="text-xs text-slate-500 mt-1 line-clamp-2">{task.description}</p>
                              )}
                              <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-slate-400">
                                {task.assigned_to_names?.length > 0 && (
                                  <span>
                                    {task.assigned_to_names.slice(0, 2).join(", ")}
                                    {task.assigned_to_names.length > 2 && ` +${task.assigned_to_names.length - 2}`}
                                  </span>
                                )}
                                {task.deadline && (
                                  <span className={cn("flex items-center gap-1", isOverdue(task) && "text-red-500 font-medium")}>
                                    <Clock className="w-3 h-3" /> {formatDateTime(task.deadline)}
                                  </span>
                                )}
                              </div>
                              {isAdmin && (
                                <div className="flex items-center gap-1 mt-2 pt-2 border-t border-slate-100">
                                  <button onClick={() => onEditTask(task)} className="p-1 rounded hover:bg-slate-100 text-slate-500" title="Edit">
                                    <Pencil className="w-3 h-3" />
                                  </button>
                                  <button onClick={() => onArchiveTask(task)} className="p-1 rounded hover:bg-slate-100 text-zinc-500" title="Archive">
                                    {task.archived ? <ArchiveRestore className="w-3 h-3" /> : <Archive className="w-3 h-3" />}
                                  </button>
                                  <button onClick={() => onDeleteTask(task)} className="p-1 rounded hover:bg-red-50 text-red-500" title="Delete">
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </Draggable>
                      );
                    })}
                    {provided.placeholder}
                    {colTasks.length === 0 && (
                      <div className="text-center text-xs text-slate-300 py-10 border-2 border-dashed border-slate-200 rounded-lg">
                        Drop tasks here
                      </div>
                    )}
                  </div>
                </div>
              )}
            </Droppable>
          );
        })}
      </div>
    </DragDropContext>
  );
}