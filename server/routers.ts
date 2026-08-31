import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { getMedicalDashboardForUser, getMedicalRecordsForUser, saveReviewedReport, deleteVisitForUser } from "./medical";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  adminDeleteUser,
  adminSetCanUpload,
  adminSetPassword,
  adminSetRole,
  adminSetStatus,
  adminUpdateUser,
  getAdminOverview,
} from "./admin";

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
  admin: router({
    overview: adminProcedure.query(() => getAdminOverview()),
    updateUser: adminProcedure
      .input(
        z.object({
          userId: z.number().int().positive(),
          email: z.string().optional(),
          patientName: z.string().nullable().optional(),
          birthYear: z.number().int().nullable().optional(),
        })
      )
      .mutation(({ input }) => {
        const { userId, ...patch } = input;
        return adminUpdateUser(userId, patch);
      }),
    setPassword: adminProcedure
      .input(z.object({ userId: z.number().int().positive(), password: z.string().min(8) }))
      .mutation(({ input }) => adminSetPassword(input.userId, input.password)),
    setStatus: adminProcedure
      .input(
        z.object({
          userId: z.number().int().positive(),
          status: z.enum(["pending", "active", "suspended"]),
        })
      )
      .mutation(({ ctx, input }) => adminSetStatus(ctx.user.id, input.userId, input.status)),
    setCanUpload: adminProcedure
      .input(z.object({ userId: z.number().int().positive(), canUpload: z.boolean() }))
      .mutation(({ input }) => adminSetCanUpload(input.userId, input.canUpload)),
    setRole: adminProcedure
      .input(
        z.object({
          userId: z.number().int().positive(),
          role: z.enum(["user", "admin"]),
        })
      )
      .mutation(({ ctx, input }) => adminSetRole(ctx.user.id, input.userId, input.role)),
    deleteUser: adminProcedure
      .input(z.object({ userId: z.number().int().positive() }))
      .mutation(({ ctx, input }) => adminDeleteUser(ctx.user.id, input.userId)),
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
      .mutation(({ ctx, input }) => {
        if (!ctx.user.canUpload) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "تم إيقاف رفع التقارير لهذا الحساب.",
          });
        }
        return saveReviewedReport(ctx.user.id, input);
      }),
    deleteVisit: protectedProcedure
      .input(z.object({ visitId: z.number().int().positive() }))
      .mutation(({ ctx, input }) => deleteVisitForUser(ctx.user.id, input.visitId)),
  }),
});

export type AppRouter = typeof appRouter;
