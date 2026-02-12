'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Heart, Target, Layers } from 'lucide-react';

export const Philosophy = () => {
    const cards = [
        {
            icon: <Heart className="text-red-500" size={28} />,
            iconBg: 'bg-red-50',
            title: 'Simplicidade Radical',
            description: 'Eliminamos a complexidade. O software deve ser invisível, permitindo que o foco total seja no treino e no resultado.',
        },
        {
            icon: <Target className="text-violet-600" size={28} />,
            iconBg: 'bg-violet-50',
            title: 'Performance First',
            description: 'Desenvolvido com as tecnologias mais rápidas. Sem carregamentos infinitos, seu fluxo de trabalho é instantâneo.',
        },
        {
            icon: <Layers className="text-emerald-600" size={28} />,
            iconBg: 'bg-emerald-50',
            title: 'De Treinador p/ Treinador',
            description: 'Não somos apenas uma empresa de tech. Entendemos as dores reais do salão de musculação e da consultoria online.',
        },
    ];

    const containerVariants = {
        hidden: {},
        visible: {
            transition: {
                staggerChildren: 0.2,
            },
        },
    };

    const cardVariants = {
        hidden: { opacity: 0, y: 30 },
        visible: {
            opacity: 1,
            y: 0,
            transition: {
                duration: 0.6,
                ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
            },
        },
    };

    return (
        <section id="philosophy" className="py-24 bg-[#F9F9FB]">
            <div className="container mx-auto px-6">
                <div className="text-center max-w-3xl mx-auto mb-16">
                    <h2 className="text-3xl md:text-5xl font-extrabold text-slate-900 tracking-tighter mb-6">
                        Nossa Filosofia
                    </h2>
                    <p className="text-slate-500 text-lg leading-relaxed">
                        Acreditamos que a tecnologia deve potencializar a inteligência do treinador, não substituí-la.
                    </p>
                </div>

                <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: '-100px' }}
                    className="grid grid-cols-1 md:grid-cols-3 gap-6"
                >
                    {cards.map((card, index) => (
                        <motion.div
                            key={index}
                            variants={cardVariants}
                            className="bg-white border border-black/[0.06] p-8 rounded-2xl hover:border-violet-200 hover:shadow-apple-elevated transition-all duration-300 group"
                        >
                            <div className={`mb-6 p-3.5 ${card.iconBg} w-fit rounded-2xl group-hover:scale-110 transition-transform`}>
                                {card.icon}
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-3">{card.title}</h3>
                            <p className="text-slate-500 leading-relaxed">{card.description}</p>
                        </motion.div>
                    ))}
                </motion.div>
            </div>
        </section>
    );
};
