import { NextRequest, NextResponse } from 'next/server'
import { updateSession } from './middleware'
import { ROLES, USER_STATUS } from '@/lib/types/roles'

// Mock the dependencies
jest.mock('@supabase/ssr', () => ({
    createServerClient: jest.fn().mockReturnValue({
        auth: {
            getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-123' } } }),
            signOut: jest.fn(),
        },
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockImplementation(() => {
            // we will override this mock per test
            return Promise.resolve({ data: null, error: null })
        }),
    }),
}))

jest.mock('next/server', () => ({
    NextResponse: {
        next: jest.fn().mockImplementation((args) => {
            return {
                ...args,
                cookies: { set: jest.fn(), get: jest.fn() }
            }
        }),
        redirect: jest.fn().mockImplementation((url) => {
            return { redirected: true, url: url.toString() }
        })
    },
    NextRequest: jest.fn().mockImplementation((url) => {
        const nextUrl = new URL(url) as any
        nextUrl.clone = () => ({
            ...nextUrl,
            pathname: nextUrl.pathname,
            clone: nextUrl.clone
        })
        return {
            nextUrl,
            cookies: { getAll: jest.fn().mockReturnValue([]) },
            url
        }
    })
}))

describe('updateSession Role-based Access', () => {
    let mockSupabase: any

    beforeEach(() => {
        jest.clearAllMocks()
        const { createServerClient } = require('@supabase/ssr')
        mockSupabase = createServerClient()
        // Default to returning a Viewer user
        mockSupabase.single.mockResolvedValue({
            data: { role: ROLES.viewer, is_active: USER_STATUS.active },
            error: null
        })
    })

    const mockProfile = (role: string, isActive: string = USER_STATUS.active) => {
        mockSupabase.single.mockResolvedValue({
            data: { role, is_active: isActive },
            error: null
        })
    }

    describe('Viewer Role', () => {
        it('cannot access Imports', async () => {
            mockProfile(ROLES.viewer)

            const req = new NextRequest('http://localhost:3000/viewer/import')
            const result = await updateSession(req as any)

            expect(NextResponse.redirect).toHaveBeenCalled()
            const redirectUrl = (NextResponse.redirect as jest.Mock).mock.calls[0][0]
            expect(redirectUrl.pathname).toBe(`/${ROLES.viewer}`)
        })

        it('can still access dashboard overview', async () => {
            mockProfile(ROLES.viewer)

            const req = new NextRequest(`http://localhost:3000/${ROLES.viewer}`)
            await updateSession(req as any)

            // Should not redirect but rather allow the request (NextResponse.next)
            expect(NextResponse.redirect).not.toHaveBeenCalled()
            expect(NextResponse.next).toHaveBeenCalled()
        })

        it('can access export summary paths (e.g. within dashboard/hlcf)', async () => {
            mockProfile(ROLES.viewer)

            const req = new NextRequest(`http://localhost:3000/${ROLES.viewer}/hlcf`)
            await updateSession(req as any)

            expect(NextResponse.redirect).not.toHaveBeenCalled()
            expect(NextResponse.next).toHaveBeenCalled()
        })
    })

    describe('Encoder Role', () => {
        it('retains full access including Imports', async () => {
            mockProfile(ROLES.encoder)

            const req = new NextRequest(`http://localhost:3000/${ROLES.encoder}/import`)
            await updateSession(req as any)

            expect(NextResponse.redirect).not.toHaveBeenCalled()
            expect(NextResponse.next).toHaveBeenCalled()
        })

        it('can access dashboard overview', async () => {
            mockProfile(ROLES.encoder)

            const req = new NextRequest(`http://localhost:3000/${ROLES.encoder}`)
            await updateSession(req as any)

            expect(NextResponse.redirect).not.toHaveBeenCalled()
            expect(NextResponse.next).toHaveBeenCalled()
        })
    })
})
