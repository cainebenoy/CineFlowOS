'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
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
}

// 1. The individual Draggable Strip Component
function SceneStrip({ scene }: { scene: StripboardScene }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: scene.scene_id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-4 bg-white border border-neutral-300 p-3 mb-2 rounded shadow-sm hover:border-neutral-400 transition-colors"
    >
      <div {...attributes} {...listeners} className="cursor-grab text-neutral-400 hover:text-neutral-900">
        <GripVertical className="w-5 h-5" />
      </div>
      
      <div className="w-12 text-center font-mono text-lg font-medium border-r border-neutral-200 pr-4">
        {scene.scene_number}
      </div>
      
      <div className="flex-shrink-0 w-16 text-xs font-bold tracking-wider text-neutral-500">
        {scene.setting}
      </div>
      
      <div className="flex-shrink-0 w-24 text-xs font-bold tracking-wider text-neutral-500">
        {scene.time_of_day}
      </div>
      
      <div className="flex-grow text-sm text-neutral-800 truncate">
        {scene.summary}
      </div>
    </div>
  );
}

// 2. The Main Board Wrapper
export default function StripboardClient({ initialScenes }: { initialScenes: StripboardScene[] }) {
  const [scenes, setScenes] = useState(initialScenes);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const params = useParams();
  const projectId = params?.id as string;

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  async function handleDragEnd(event: any) {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setScenes((items) => {
        const oldIndex = items.findIndex((item) => item.scene_id === active.id);
        const newIndex = items.findIndex((item) => item.scene_id === over.id);
        
        const newOrder = arrayMove(items, oldIndex, newIndex);
        const orderedSceneIDs = newOrder.map(scene => scene.scene_id);

        if (projectId) {
          fetch(`http://localhost:8080/api/projects/${projectId}/schedule/order`, {
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

  if (!mounted) {
    // Render static, non-interactive skeleton layout on SSR to avoid hydration mismatch
    return (
      <div className="max-w-4xl mt-8">
        <div className="mb-4">
          <h2 className="text-sm font-bold text-neutral-500 uppercase tracking-wider mb-4">The Boneyard (Unscheduled)</h2>
        </div>
        <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-4 min-h-[500px]">
          {scenes.map((scene) => (
            <div
              key={scene.scene_id}
              className="flex items-center gap-4 bg-white border border-neutral-300 p-3 mb-2 rounded shadow-sm"
            >
              <div className="text-neutral-400">
                <GripVertical className="w-5 h-5" />
              </div>
              <div className="w-12 text-center font-mono text-lg font-medium border-r border-neutral-200 pr-4">
                {scene.scene_number}
              </div>
              <div className="flex-shrink-0 w-16 text-xs font-bold tracking-wider text-neutral-500">
                {scene.setting}
              </div>
              <div className="flex-shrink-0 w-24 text-xs font-bold tracking-wider text-neutral-500">
                {scene.time_of_day}
              </div>
              <div className="flex-grow text-sm text-neutral-800 truncate">
                {scene.summary}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mt-8">
      <div className="mb-4">
        <h2 className="text-sm font-bold text-neutral-500 uppercase tracking-wider mb-4">The Boneyard (Unscheduled)</h2>
      </div>
      
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={scenes.map(s => s.scene_id)} strategy={verticalListSortingStrategy}>
          <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-4 min-h-[500px]">
            {scenes.map((scene) => (
              <SceneStrip key={scene.scene_id} scene={scene} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
