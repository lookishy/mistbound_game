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
    <div className="w-full overflow-x-auto overflow-y-hidden bg-slate-900 border border-slate-700 rounded-xl shadow-2xl relative">
      <svg width="1000" height="650" className="mx-auto block" style={{ minWidth: '1000px' }}>
        <defs>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {MAP_EDGES.map(([src, dst], idx) => {
          const p1 = NODE_POSITIONS[src];
          const p2 = NODE_POSITIONS[dst];
          return (
            <line
              key={`edge-${idx}`}
              x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
              stroke="#334155"
              strokeWidth="2"
            />
          );
        })}

        {Object.values(nodes).map(node => {
          const pos = NODE_POSITIONS[node.id];
          if (!pos) return null;

          const owner = node.ownerId ? players.find(p => p.id === node.ownerId) : null;
          const fillColor = owner ? owner.color : '#1e293b';
          const strokeColor = owner ? owner.color : '#475569';

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
              <circle
                r={r}
                fill={node.isStormLocked ? '#64748b' : fillColor}
                stroke={node.isStormLocked ? '#94a3b8' : strokeColor}
                strokeWidth={isSpecial ? 4 : 2}
                filter={owner ? 'url(#glow)' : ''}
                className={node.isLocked && !isSpecial ? 'opacity-50' : ''}
              />

              {node.isStormLocked && (
                <text y="-5" textAnchor="middle" fill="#f8fafc" fontSize="10" fontWeight="bold">风暴</text>
              )}
              {node.isLocked && !isSpecial && !node.isStormLocked && (
                <text y="-5" textAnchor="middle" fill="#ef4444" fontSize="12" fontWeight="bold">锁定</text>
              )}

              <text
                y={isSpecial ? 5 : 5}
                textAnchor="middle"
                fill="#ffffff"
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
                  fill="#94a3b8"
                  fontSize="10"
                  className="pointer-events-none select-none"
                >
                  ${node.currentPrice}
                </text>
              )}

              {!isSpecial && node.captureHistory.length > 0 && (
                <g transform="translate(0, 32)">
                  {node.captureHistory.map((color, i) => (
                    <circle
                      key={i}
                      cx={(i - (node.captureHistory.length - 1) / 2) * 8}
                      cy="0"
                      r="3"
                      fill={color}
                      stroke="#0f172a"
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
