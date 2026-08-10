import { z } from "zod";

// Zod otherwise probes `new Function` before selecting its optimized object
// parser. The probe is caught, but strict production CSP still reports it as a
// violation. Jitless mode keeps validation deterministic without eval.
z.config({ jitless: true });

export { z };
