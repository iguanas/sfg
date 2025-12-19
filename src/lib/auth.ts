import NextAuth from 'next-auth';
import { PrismaAdapter } from '@auth/prisma-adapter';
import Credentials from 'next-auth/providers/credentials';
import { prisma } from '@/lib/db/prisma';

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/login',
  },
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        // For development: accept any email with password "admin123"
        // In production, implement proper password hashing with bcrypt
        if (process.env.NODE_ENV === 'development') {
          if (credentials.password === 'admin123') {
            // Find or create user
            let user = await prisma.user.findUnique({
              where: { email: credentials.email as string },
            });

            if (!user) {
              user = await prisma.user.create({
                data: {
                  email: credentials.email as string,
                  name: 'Admin User',
                  role: 'ADMIN',
                },
              });
            }

            return {
              id: user.id,
              email: user.email,
              name: user.name,
              role: user.role,
            };
          }
        }

        // Production: implement proper authentication
        // const user = await prisma.user.findUnique({
        //   where: { email: credentials.email as string },
        // });
        // if (!user || !user.passwordHash) return null;
        // const isValid = await bcrypt.compare(credentials.password, user.passwordHash);
        // if (!isValid) return null;
        // return { id: user.id, email: user.email, name: user.name, role: user.role };

        return null;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
      }
      return session;
    },
  },
});

// Type augmentation for NextAuth
declare module 'next-auth' {
  interface User {
    role?: string;
  }
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: string;
    };
  }
}

declare module '@auth/core/jwt' {
  interface JWT {
    id?: string;
    role?: string;
  }
}
