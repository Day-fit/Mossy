export type SectionLeafVariant = 'sprigs' | 'canopy' | 'ferns';

type LeafShape = 'round' | 'lance' | 'lobed' | 'sprig' | 'fern';

const leafShapes: Record<LeafShape, { outline: string; veins: string }> = {
    round: {
        outline:
            'M25 98C8 74 18 43 42 33C67 22 90 29 101 15C106 47 101 75 79 92C61 106 42 105 25 98Z',
        veins: 'M18 110Q49 79 94 26M39 88L30 63M54 73L51 45M70 55L85 56M46 82L73 84',
    },
    lance: {
        outline: 'M26 98C22 53 46 28 103 16C94 64 71 98 26 98Z',
        veins: 'M18 108Q59 68 96 24M41 86L39 62M58 68L59 44M48 79L72 77M73 51L87 51',
    },
    lobed: {
        outline:
            'M26 99Q10 85 25 73Q10 53 32 48Q26 29 49 30Q56 11 75 24Q90 15 103 12Q111 39 93 46Q107 64 86 72Q86 94 64 90Q46 110 26 99Z',
        veins: 'M18 110Q54 78 97 23M37 91L29 77M50 78L37 55M67 60L61 35M52 76L72 82M70 56L89 57',
    },
    sprig: {
        outline:
            'M58 62C27 59 15 39 20 20C48 20 66 34 58 62ZM62 48C60 22 80 11 105 13C108 39 89 55 62 48Z',
        veins: 'M55 110Q66 82 58 62L35 38M61 83Q59 67 62 48L88 29',
    },
    fern: {
        outline:
            'M61 92Q33 94 23 75Q49 73 61 92ZM63 79Q88 83 104 65Q79 60 63 79ZM58 67Q32 67 24 49Q47 47 58 67ZM62 54Q85 59 100 40Q77 37 62 54ZM59 40Q40 38 36 23Q55 24 59 40ZM62 30Q76 26 80 11Q63 13 62 30Z',
        veins: 'M57 112Q68 79 59 40L62 20M61 91L37 81M63 78L91 69M59 66L37 55M62 54L86 45',
    },
};

const placements = [
    'left-2 top-0 w-20 -rotate-25 md:left-6 md:-top-4 md:w-32',
    'right-1 top-2 w-16 rotate-35 md:right-8 md:top-0 md:w-24',
    'bottom-0 left-4 w-16 rotate-160 md:-bottom-4 md:left-10 md:w-28',
    'bottom-0 right-1 w-20 -rotate-110 md:-bottom-4 md:right-4 md:w-32',
    'left-0 top-1/2 hidden w-24 -translate-x-1/2 -translate-y-1/2 rotate-15 xl:block',
];

const arrangements: Record<SectionLeafVariant, LeafShape[]> = {
    sprigs: ['sprig', 'lance', 'round', 'sprig', 'fern'],
    canopy: ['lobed', 'round', 'lance', 'lobed', 'sprig'],
    ferns: ['fern', 'sprig', 'fern', 'lance', 'round'],
};

export default function SectionLeaves({
    variant,
}: {
    variant: SectionLeafVariant;
}) {
    return (
        <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 overflow-hidden"
        >
            {arrangements[variant].map((shape, index) => (
                <svg
                    key={index}
                    viewBox="0 0 120 120"
                    fill="none"
                    focusable="false"
                    className={`absolute h-auto text-brand ${placements[index]}`}
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <path
                        d={leafShapes[shape].outline}
                        fill="currentColor"
                        fillOpacity="0.07"
                        strokeOpacity="0.25"
                    />
                    <path d={leafShapes[shape].veins} strokeOpacity="0.2" />
                </svg>
            ))}
        </div>
    );
}
