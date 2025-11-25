"use client";

import { useState, useEffect } from "react";

interface Particle {
    id: number;
    left: number;
    delay: number;
    duration: number;
    size: number;
    color: string;
    blur: number;
}

const PARTICLE_COLORS = [
    "var(--gradient-start)",
    "var(--gradient-mid)",
    "var(--gradient-end)",
];

export function FloatingParticles() {
    const [particles, setParticles] = useState<Particle[]>([]);

    useEffect(() => {
        const particleCount = 25;
        const newParticles: Particle[] = [];

        for (let i = 0; i < particleCount; i++) {
            newParticles.push({
                id: i,
                left: Math.random() * 100,
                delay: Math.random() * 25,
                duration: 20 + Math.random() * 25,
                size: 3 + Math.random() * 6,
                color: PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)],
                blur: Math.random() > 0.5 ? 1 : 0,
            });
        }

        setParticles(newParticles);
    }, []);

    // Render nothing on server, particles only appear after hydration
    if (particles.length === 0) {
        return <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10" />;
    }

    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10">
            {particles.map((particle) => (
                <div
                    key={particle.id}
                    className="absolute bottom-0 rounded-full"
                    style={{
                        left: `${particle.left}%`,
                        width: `${particle.size}px`,
                        height: `${particle.size}px`,
                        backgroundColor: particle.color,
                        opacity: 0.4,
                        filter: particle.blur ? `blur(${particle.blur}px)` : undefined,
                        animation: `float ${particle.duration}s linear infinite`,
                        animationDelay: `-${particle.delay}s`,
                        boxShadow: `0 0 ${particle.size * 2}px ${particle.color}`,
                    }}
                />
            ))}
        </div>
    );
}
