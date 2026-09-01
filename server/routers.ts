import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { getMedicalDashboardForUser, getMedicalRecordsForUser, saveReviewedReport, deleteVisitForUser, updateResultForUser, getVisitResultsForUser, checkDuplicateReport, mergeIntoVisit, setFollowUpDate, getReminders } from "./medical";
import { listDocumentsForVisit } from "./documents";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  assertOwnedProfile,
  createProfile,
  deleteProfile,
  getDefaultProfileId,
  listProfiles,
  updateProfile,
} from "./profiles";
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
  profiles: router({
    list: protectedProcedure.query(({ ctx }) => listProfiles(ctx.user.id)),
    create: protectedProcedure
      .input(
        z.object({
          name: z.string().min(2),
          relation: z.string().nullable(),
          birthYear: z.number().int().nullable(),
        })
      )
      .mutation(({ ctx, input }) => createProfile(ctx.user.id, input)),
    update: protectedProcedure
      .input(
        z.object({
          profileId: z.number().int().positive(),
          name: z.string().min(2).optional(),
          relation: z.string().nullable().optional(),
          birthYear: z.number().int().nullable().optional(),
        })
      )
      .mutation(({ ctx, input }) => {
        const { profileId, ...patch } = input;
        return updateProfile(ctx.user.id, profileId, patch);
      }),
    remove: protectedProcedure
      .input(z.object({ profileId: z.number().int().positive() }))
      .mutation(({ ctx, input }) => deleteProfile(ctx.user.id, input.profileId)),
  }),
  medical: router({
    dashboard: protectedProcedure
      .input(z.object({ profileId: z.number().int().positive().optional() }).optional())
      .query(async ({ ctx, input }) => {
        const profileId = input?.profileId
          ? await assertOwnedProfile(ctx.user.id, input.profileId)
          : await getDefaultProfileId(ctx.user.id, ctx.user.patientName);
        return getMedicalDashboardForUser(ctx.user.id, profileId);
      }),
    timeline: protectedProcedure
      .input(z.object({ profileId: z.number().int().positive().optional() }).optional())
      .query(async ({ ctx, input }) => {
        const profileId = input?.profileId
          ? await assertOwnedProfile(ctx.user.id, input.profileId)
          : await getDefaultProfileId(ctx.user.id, ctx.user.patientName);
        return getMedicalRecordsForUser(ctx.user.id, profileId);
      }),
    saveReport: protectedProcedure
      .input(
        z.object({
          profileId: z.number().int().positive().optional(),
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
            ),
          reportType: z.string().nullable().optional(),
          summaryAr: z.string().nullable().optional(),
          clinicalText: z.string().nullable().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user.canUpload) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "تم إيقاف رفع التقارير لهذا الحساب.",
          });
        }
        const profileId = input.profileId
          ? await assertOwnedProfile(ctx.user.id, input.profileId)
          : await getDefaultProfileId(ctx.user.id, ctx.user.patientName);
        return saveReviewedReport(ctx.user.id, profileId, input);
      }),
    visitResults: protectedProcedure
      .input(z.object({ visitId: z.number().int().positive() }))
      .query(({ ctx, input }) => getVisitResultsForUser(ctx.user.id, input.visitId)),
    visitDocuments: protectedProcedure
      .input(z.object({ visitId: z.number().int().positive() }))
      .query(({ ctx, input }) => listDocumentsForVisit(ctx.user.id, input.visitId)),
    updateResult: protectedProcedure
      .input(
        z.object({
          resultId: z.number().int().positive(),
          label: z.string().min(1).optional(),
          value: z.string().min(1).optional(),
          numericValue: z.number().nullable().optional(),
          unit: z.string().nullable().optional(),
          referenceRange: z.string().nullable().optional(),
        })
      )
      .mutation(({ ctx, input }) => {
        const { resultId, ...patch } = input;
        return updateResultForUser(ctx.user.id, resultId, patch);
      }),
    checkDuplicate: protectedProcedure
      .input(
        z.object({
          profileId: z.number().int().positive().optional(),
          examDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          results: z.array(z.object({ label: z.string(), value: z.string() })),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const profileId = input.profileId
          ? await assertOwnedProfile(ctx.user.id, input.profileId)
          : await getDefaultProfileId(ctx.user.id, ctx.user.patientName);
        return checkDuplicateReport(ctx.user.id, profileId, input.examDate, input.results);
      }),
    mergeReport: protectedProcedure
      .input(
        z.object({
          visitId: z.number().int().positive(),
          updateChanged: z.boolean(),
          results: z.array(
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
          ),
        })
      )
      .mutation(({ ctx, input }) => {
        if (!ctx.user.canUpload) {
          throw new TRPCError({ code: "FORBIDDEN", message: "تم إيقاف رفع التقارير لهذا الحساب." });
        }
        return mergeIntoVisit(ctx.user.id, input.visitId, input.results, input.updateChanged);
      }),
    setFollowUpDate: protectedProcedure
      .input(z.object({ resultId: z.number().int().positive(), followUpDate: z.string().nullable() }))
      .mutation(({ ctx, input }) => setFollowUpDate(ctx.user.id, input.resultId, input.followUpDate)),
    reminders: protectedProcedure
      .input(z.object({ profileId: z.number().int().positive().optional() }).optional())
      .query(async ({ ctx, input }) => {
        const profileId = input?.profileId
          ? await assertOwnedProfile(ctx.user.id, input.profileId)
          : await getDefaultProfileId(ctx.user.id, ctx.user.patientName);
        return getReminders(ctx.user.id, profileId);
      }),
    deleteVisit: protectedProcedure
      .input(z.object({ visitId: z.number().int().positive() }))
      .mutation(({ ctx, input }) => deleteVisitForUser(ctx.user.id, input.visitId)),
  }),
});

export type AppRouter = typeof appRouter;
