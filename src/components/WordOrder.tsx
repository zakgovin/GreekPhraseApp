import { useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { GripVertical, X } from "lucide-react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

function SortableWord({
  id,
  word,
  onRemove,
}: {
  id: number;
  word: string;
  onRemove: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, transition: null });
  return (
    <span
      ref={setNodeRef}
      className={
        "word-chip selected sortable-word" +
        (isDragging ? " word-dragging" : "")
      }
      data-selected-word-id={id}
      style={{ transform: CSS.Translate.toString(transform), transition }}
    >
      <button
        type="button"
        className="word-handle"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label={"Переместить слово " + word}
        aria-roledescription="перемещаемое слово"
        lang="ru"
        onContextMenu={(event) => event.preventDefault()}
      >
        <GripVertical size={12} aria-hidden="true" />
        <span lang="el">{word}</span>
      </button>
      <button
        type="button"
        className="word-remove"
        aria-label={"Убрать слово " + word}
        lang="ru"
        onClick={onRemove}
      >
        <X size={14} aria-hidden="true" />
      </button>
    </span>
  );
}

export function WordOrder({
  words,
  order,
  onChange,
}: {
  words: string[];
  order: number[];
  onChange: (order: number[]) => void;
}) {
  const contextId = useId();
  const container = useRef<HTMLDivElement>(null);
  const [activeId, setActiveId] = useState<number | null>(null);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    // Scrolling stays natural; a short hold starts a deliberate word move.
    useSensor(TouchSensor, {
      activationConstraint: { delay: 180, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  return (
    <>
      <DndContext
        id={contextId}
        sensors={sensors}
        collisionDetection={closestCenter}
        autoScroll={{
          threshold: { x: 0.08, y: 0.08 },
          acceleration: 5,
          canScroll: () => {
            const rect = container.current?.getBoundingClientRect();
            // Moving a word inside a fully visible answer should not move the page.
            return Boolean(
              rect && (rect.top < 12 || rect.bottom > window.innerHeight - 90),
            );
          },
        }}
        accessibility={{
          screenReaderInstructions: {
            draggable:
              "Чтобы переместить слово, нажми пробел, выбери место стрелками и снова нажми пробел. Escape отменяет перенос.",
          },
          announcements: {
            onDragStart: ({ active }) =>
              `Перенос слова ${words[Number(active.id)]}.`,
            onDragOver: ({ active, over }) =>
              over
                ? `Слово ${words[Number(active.id)]}, место ${order.indexOf(Number(over.id)) + 1} из ${order.length}.`
                : undefined,
            onDragEnd: ({ active, over }) =>
              over
                ? `Слово ${words[Number(active.id)]} перемещено на место ${order.indexOf(Number(over.id)) + 1}.`
                : "Перенос отменён.",
            onDragCancel: () => "Перенос отменён.",
          },
        }}
        onDragStart={({ active }) => setActiveId(Number(active.id))}
        onDragCancel={() => setActiveId(null)}
        onDragEnd={({ active, over }) => {
          setActiveId(null);
          if (!over || active.id === over.id) return;
          const from = order.indexOf(Number(active.id)),
            to = order.indexOf(Number(over.id));
          if (from >= 0 && to >= 0) onChange(arrayMove(order, from, to));
        }}
      >
        <div
          className="sentence-answer"
          ref={container}
          role="group"
          aria-label="Твой ответ"
          lang="el"
        >
          {!order.length && (
            <span className="answer-placeholder" lang="ru">
              Нажимай на слова в нужном порядке
            </span>
          )}
          <SortableContext items={order} strategy={rectSortingStrategy}>
            {order.map((id) => (
              <SortableWord
                key={id}
                id={id}
                word={words[id]}
                onRemove={() => onChange(order.filter((value) => value !== id))}
              />
            ))}
          </SortableContext>
        </div>
        {createPortal(
          <DragOverlay dropAnimation={null}>
            {activeId !== null && (
              <span
                className="word-chip selected word-overlay"
                lang="el"
                aria-hidden="true"
              >
                <GripVertical size={12} />
                {words[activeId]}
              </span>
            )}
          </DragOverlay>,
          document.body,
        )}
      </DndContext>
      {order.length > 1 && (
        <p className="word-order-hint">
          Удерживай и перетаскивай слова, чтобы поменять порядок.
        </p>
      )}
    </>
  );
}
