import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { getMedicalDashboardForUser, getMedicalRecordsForUser, saveReviewedReport, deleteVisitForUser } from "./medical";
import { z } from "zod";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),
  medical: router({
    dashboard: protectedProcedure.query(({ ctx }) => getMedicalDashboardForUser(ctx.user.id)),
    timeline: protectedProcedure.query(({ ctx }) => getMedicalRecordsForUser(ctx.user.id)),
    saveReport: protectedProcedure
      .input(
        z.object({
          examDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          facility: z.string().nullable(),
          physician: z.string().nullable(),
          results: z
            .array(
              z.object({
                label: z.string().min(1),
                category: z.string(),
                value: z.string().min(1),
                numericValue: z.number().nullable(),
                unit: z.string().nullable(),
                referenceRange: z.string().nullable(),
                abbr: z.string().nullable().optional(),
                about: z.string().nullable().optional(),
              })
            )
            .min(1),
        })
      )
      .mutation(({ ctx, input }) => saveReviewedReport(ctx.user.id, input)),
    deleteVisit: protectedProcedure
      .input(z.object({ visitId: z.number().int().positive() }))
      .mutation(({ ctx, input }) => deleteVisitForUser(ctx.user.id, input.visitId)),
  }),
});

export type AppRouter = typeof appRouter;
