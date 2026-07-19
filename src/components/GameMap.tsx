import React from 'react';
import { type GameState, type NodeState } from '../types';
import { MAP_EDGES, NODE_POSITIONS } from '../lib/mapData';

interface MapProps {
  gameState: GameState;
  onNodeClick: (node: NodeState) => void;
}

export const GameMap: React.FC<MapProps> = ({ gameState, onNodeClick }) => {
  const { nodes, players } = gameState;

  if (!nodes || Object.keys(nodes).length === 0) return null;

  return (
    <div className="w-full overflow-x-auto overflow-y-hidden bg-stone-900/50 border border-amber-900/40 rounded-xl shadow-[0_0_40px_rgba(180,83,9,0.15)] relative backdrop-blur-sm">
      <svg width="1000" height="650" className="mx-auto block relative z-10" style={{ minWidth: '1000px' }}>
        <defs>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge>
              <feMergeNode in="blur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          <filter id="fog-filter" x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.01" numOctaves="3" result="noise" />
            <feColorMatrix type="matrix" values="1 0 0 0 0.4   0 1 0 0 0.3   0 0 1 0 0.2  0 0 0 0.3 0" />
            <feBlend mode="multiply" in="SourceGraphic" in2="noise" />
          </filter>
        </defs>

        <rect width="100%" height="100%" className="map-fog" />

        {MAP_EDGES.map(([src, dst], idx) => {
          const p1 = NODE_POSITIONS[src];
          const p2 = NODE_POSITIONS[dst];
          return (
            <line
              key={`edge-${idx}`}
              x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
              stroke="#78350f"
              strokeWidth="2"
              opacity="0.6"
            />
          );
        })}

        {Object.values(nodes).map(node => {
          const pos = NODE_POSITIONS[node.id];
          if (!pos) return null;

          const owner = node.ownerId ? players.find(p => p.id === node.ownerId) : null;
          const fillColor = owner ? owner.color : '#292524';
          const strokeColor = owner ? owner.color : '#b45309';

          const isSpecial = node.id === 'START' || node.id === 'END';
          const r = isSpecial ? 25 : 20;

          return (
            <g
              key={node.id}
              transform={`translate(${pos.x}, ${pos.y})`}
              className={`transition-transform duration-200 ${!isSpecial && !node.isLocked && !node.isStormLocked ? 'hover:-translate-y-[3px] cursor-pointer' : ''}`}
              onClick={() => {
                if (!isSpecial && !node.isLocked && !node.isStormLocked) {
                  onNodeClick(node);
                }
              }}
            >
              {node.isStormLocked && (
                <circle r={r + 8} fill="rgba(168, 162, 158, 0.4)" filter="url(#glow)" />
              )}

              <circle
                r={r}
                fill={node.isStormLocked ? '#57534e' : fillColor}
                stroke={node.isStormLocked ? '#a8a29e' : strokeColor}
                strokeWidth={isSpecial ? 4 : 2}
                filter={owner || node.isStormLocked ? 'url(#glow)' : ''}
                className={node.isLocked && !isSpecial ? 'opacity-50' : ''}
              />

              {node.isStormLocked && (
                <text y="-5" textAnchor="middle" fill="#f5f5f4" fontSize="10" fontWeight="bold">风暴</text>
              )}
              {node.isLocked && !isSpecial && !node.isStormLocked && (
                <text y="-5" textAnchor="middle" fill="#ef4444" fontSize="12" fontWeight="bold">锁定</text>
              )}

              <text
                y={isSpecial ? 5 : 5}
                textAnchor="middle"
                fill="#fed7aa"
                fontSize={isSpecial ? "16" : "12"}
                fontWeight="bold"
                className="pointer-events-none select-none"
              >
                {node.name}
              </text>

              {!isSpecial && (
                <text
                  y={22}
                  textAnchor="middle"
                  fill="#d97706"
                  fontSize="10"
                  fontWeight="bold"
                  className="pointer-events-none select-none drop-shadow-md"
                >
                  ${node.currentPrice}
                </text>
              )}

              {!isSpecial && node.captureHistory.length > 0 && (
                <g transform="translate(0, 34)">
                  {node.captureHistory.map((color, i) => (
                    <circle
                      key={i}
                      cx={(i - (node.captureHistory.length - 1) / 2) * 8}
                      cy="0"
                      r="3"
                      fill={color}
                      stroke="#451a03"
                      strokeWidth="1"
                    />
                  ))}
                </g>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
};
