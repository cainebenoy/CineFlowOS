'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { DndContext, closestCorners, KeyboardSensor, PointerSensor, useSensor, useSensors, DragOverlay } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';

interface StripboardScene {
  id: string;
  scene_id: string;
  scene_number: string;
  setting: string;
  time_of_day: string;
  summary: string;
  elements?: { category: string; name: string }[];
}

// Helper to determine strip color based on industry standards
function getStripColor(setting: string, timeOfDay: string) {
  const s = setting?.toUpperCase() || '';
  const t = timeOfDay?.toUpperCase() || '';
  
  if (s.includes('EXT') && (t.includes('NIGHT') || t.includes('EVENING'))) return 'border-l-indigo-600 bg-indigo-50/40';
  if (s.includes('INT') && (t.includes('NIGHT') || t.includes('EVENING'))) return 'border-l-cyan-500 bg-cyan-50/40';
  if (s.includes('EXT') && (t.includes('DAY') || t.includes('DAWN') || t.includes('MORNING'))) return 'border-l-yellow-400 bg-yellow-50/50';
  if (s.includes('INT') && (t.includes('DAY') || t.includes('DAWN') || t.includes('MORNING'))) return 'border-l-neutral-300 bg-white';
  
  return 'border-l-neutral-300 bg-white';
}

// 1. Presentational component for both the list and the DragOverlay
function SceneStripCard({ scene, attributes, listeners, setNodeRef, style, isOverlay, isDragging }: any) {
  const colorClass = getStripColor(scene.setting, scene.time_of_day);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-4 border border-neutral-300 border-l-8 p-3 mb-2 rounded transition-colors ${colorClass} ${isDragging && !isOverlay ? 'opacity-30' : 'opacity-100'} ${isOverlay ? 'shadow-2xl cursor-grabbing scale-[1.02] z-50' : 'shadow-sm hover:shadow-md'}`}
    >
      <div {...attributes} {...listeners} className={`text-neutral-400 hover:text-neutral-900 p-1 ${isOverlay ? 'cursor-grabbing' : 'cursor-grab'}`}>
        <GripVertical className="w-5 h-5" />
      </div>
      
      <div className="w-12 flex-shrink-0 text-center font-mono text-lg font-bold border-r border-neutral-200 pr-4">
        {scene.scene_number}
      </div>
      
      <div className="flex-shrink-0 w-64 px-4 text-sm font-bold uppercase tracking-wide text-neutral-900 leading-snug">
        {scene.setting}
      </div>
      
      <div className="flex-shrink-0 w-24 px-2 text-xs font-bold uppercase tracking-widest text-neutral-500">
        {scene.time_of_day}
      </div>
      
      <div className="flex-grow text-sm text-neutral-800 min-w-0 overflow-hidden">
        <div className="leading-relaxed font-medium">{scene.summary}</div>
        {scene.elements && scene.elements.length > 0 && (
          <div className="flex gap-2 mt-2 flex-wrap">
            {scene.elements.map((el: any, idx: number) => (
              <span key={idx} className={`text-[11px] px-2 py-1 rounded-md whitespace-nowrap font-semibold shadow-sm ${el.category.toLowerCase() === 'cast' ? 'bg-blue-50 text-blue-800 border border-blue-200' : 'bg-white text-neutral-700 border border-neutral-300'}`}>
                {el.name}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// 2. The Sortable Wrapper Component
function SceneStrip({ scene }: { scene: StripboardScene }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: scene.scene_id });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  return <SceneStripCard scene={scene} attributes={attributes} listeners={listeners} setNodeRef={setNodeRef} style={style} isDragging={isDragging} />;
}

// 2. The Main Board Wrapper
export default function StripboardClient({ initialScenes }: { initialScenes: StripboardScene[] }) {
  const [scenes, setScenes] = useState(initialScenes);
  const [mounted, setMounted] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const params = useParams();
  const projectId = params?.id as string;

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // Require moving 5px before drag starts to prevent accidental drags
      },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragStart(event: any) {
    setActiveId(event.active.id);
  }

  async function handleDragEnd(event: any) {
    setActiveId(null);
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setScenes((items) => {
        const oldIndex = items.findIndex((item) => item.scene_id === active.id);
        const newIndex = items.findIndex((item) => item.scene_id === over.id);
        
        if (oldIndex === -1 || newIndex === -1) return items;

        const newOrder = arrayMove(items, oldIndex, newIndex);
        const orderedSceneIDs = newOrder.map(scene => scene.scene_id);

        if (projectId) {
          fetch(`${process.env.NEXT_PUBLIC_GO_API_URL || 'http://localhost:8080'}/api/projects/${projectId}/schedule/order`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ ordered_scene_ids: orderedSceneIDs }),
          }).catch(err => console.error("Failed to sync order:", err));
        }

        return newOrder;
      });
    }
  }

  function handleDragCancel() {
    setActiveId(null);
  }

  if (!mounted) {
    // Render static, non-interactive skeleton layout on SSR to avoid hydration mismatch
    return (
      <div className="max-w-4xl mt-8">
        <div className="mb-4">
          <h2 className="text-sm font-bold text-neutral-500 uppercase tracking-wider mb-4">The Boneyard (Unscheduled)</h2>
        </div>
        <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-4 min-h-[500px] shadow-inner">
          {scenes.map((scene) => {
            const colorClass = getStripColor(scene.setting, scene.time_of_day);
            return (
            <div
              key={scene.scene_id}
              className={`flex items-center gap-4 border border-neutral-300 border-l-8 p-3 mb-2 rounded shadow-sm ${colorClass}`}
            >
              <div className="text-neutral-300 p-1">
                <GripVertical className="w-5 h-5" />
              </div>
              <div className="w-12 flex-shrink-0 text-center font-mono text-lg font-bold border-r border-neutral-200 pr-4">
                {scene.scene_number}
              </div>
              <div className="flex-shrink-0 w-64 px-4 text-sm font-bold uppercase tracking-wide text-neutral-900 leading-snug">
                {scene.setting}
              </div>
              <div className="flex-shrink-0 w-24 px-2 text-xs font-bold uppercase tracking-widest text-neutral-500">
                {scene.time_of_day}
              </div>
              <div className="flex-grow text-sm text-neutral-800 min-w-0 overflow-hidden">
                <div className="leading-relaxed font-medium">{scene.summary}</div>
                {scene.elements && scene.elements.length > 0 && (
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {scene.elements.map((el, idx) => (
                      <span key={idx} className={`text-[11px] px-2 py-1 rounded-md whitespace-nowrap font-semibold shadow-sm ${el.category.toLowerCase() === 'cast' ? 'bg-blue-50 text-blue-800 border border-blue-200' : 'bg-white text-neutral-700 border border-neutral-300'}`}>
                        {el.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )})}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mt-8">
      <div className="mb-4">
        <h2 className="text-sm font-bold text-neutral-500 uppercase tracking-wider mb-4">The Boneyard (Unscheduled)</h2>
      </div>
      
      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={handleDragCancel}>
        <SortableContext items={scenes.map(s => s.scene_id)} strategy={verticalListSortingStrategy}>
          <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-4 min-h-[500px]">
            {scenes.map((scene) => (
              <SceneStrip key={scene.scene_id} scene={scene} />
            ))}
          </div>
        </SortableContext>
        <DragOverlay>
          {activeId ? (
            <SceneStripCard scene={scenes.find(s => s.scene_id === activeId)} isOverlay={true} />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
