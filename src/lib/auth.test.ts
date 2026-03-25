import {
  changeUserPassword,
  loginUser,
  registerUser,
  requestPasswordReset,
  resetPasswordWithCode,
  updateUserProfile,
  upsertGoogleUser,
} from './auth';
import { createWorkspace } from './workspace';

describe('auth flows', () => {
  test('registers a user and creates a workspace', async () => {
    const result = await registerUser([], [], {
      name: 'Anna Nowak',
      email: 'anna@example.com',
      password: 'tajne123',
      role: 'PM',
      company: 'VoiceLog',
      workspaceMode: 'create',
      workspaceName: 'Produkt',
    });

    expect(result.user.email).toBe('anna@example.com');
    expect(result.workspaceId).toBeTruthy();
    expect(result.workspaces).toHaveLength(1);
    expect(result.workspaces[0].ownerUserId).toBe(result.user.id);
    expect(result.workspaces[0].memberIds).toContain(result.user.id);
  });

  test('joins an existing workspace and can log in to it', async () => {
    const workspace = createWorkspace('Sprzedaz', 'owner_1');
    const registerResult = await registerUser([], [workspace], {
      name: 'Jan Kowalski',
      email: 'jan@example.com',
      password: 'sekret12',
      workspaceMode: 'join',
      workspaceCode: workspace.inviteCode,
    });

    const joinedWorkspace = registerResult.workspaces.find((item) => item.id === workspace.id);
    expect(joinedWorkspace.memberIds).toContain(registerResult.user.id);

    const loginResult = await loginUser(registerResult.users, registerResult.workspaces, {
      email: 'jan@example.com',
      password: 'sekret12',
      workspaceId: workspace.id,
    });

    expect(loginResult.user.id).toBe(registerResult.user.id);
    expect(loginResult.workspaceId).toBe(workspace.id);
  });

  test('resets password with a recovery code', async () => {
    const registerResult = await registerUser([], [], {
      name: 'Marta',
      email: 'marta@example.com',
      password: 'haslo123',
      workspaceMode: 'create',
      workspaceName: 'Wsparcie',
    });

    const resetResult = await requestPasswordReset(registerResult.users, {
      email: 'marta@example.com',
    });

    expect(resetResult.recoveryCode).toHaveLength(6);

    const usersAfterReset = await resetPasswordWithCode(resetResult.users, {
      email: 'marta@example.com',
      code: resetResult.recoveryCode,
      newPassword: 'nowehaslo1',
      confirmPassword: 'nowehaslo1',
    });

    const loginResult = await loginUser(usersAfterReset, registerResult.workspaces, {
      email: 'marta@example.com',
      password: 'nowehaslo1',
    });

    expect(loginResult.user.email).toBe('marta@example.com');
  });

  test('rejects login when a specific workspace is requested but user is not a member', async () => {
    const workspace = createWorkspace('Sprzedaz', 'owner_1');
    const otherWorkspace = createWorkspace('Marketing', 'owner_2');
    const registerResult = await registerUser([], [workspace, otherWorkspace], {
      name: 'Jan Kowalski',
      email: 'jan@example.com',
      password: 'sekret12',
      workspaceMode: 'join',
      workspaceCode: workspace.inviteCode,
    });

    await expect(
      loginUser(registerResult.users, registerResult.workspaces, {
        email: 'jan@example.com',
        password: 'sekret12',
        workspaceId: otherWorkspace.id,
      })
    ).rejects.toThrow('Nie masz dostepu do wybranego workspace.');
  });

  test('shows a dedicated message for Google-managed accounts during password login', async () => {
    await expect(
      loginUser(
        [
          {
            id: 'user_google_1',
            email: 'google@example.com',
            passwordHash: null,
            provider: 'google',
            workspaceIds: ['workspace_1'],
            defaultWorkspaceId: 'workspace_1',
          },
        ],
        [{ id: 'workspace_1', memberIds: ['user_google_1'] }],
        {
          email: 'google@example.com',
          password: 'sekret12',
        }
      )
    ).rejects.toThrow('To konto korzysta z logowania Google. Uzyj przycisku Google.');
  });

  test('persists the auto speaker learning preference in the user profile', async () => {
    const registerResult = await registerUser([], [], {
      name: 'Anna Nowak',
      email: 'anna@example.com',
      password: 'tajne123',
      workspaceMode: 'create',
      workspaceName: 'Produkt',
    });

    const updatedUsers = updateUserProfile(registerResult.users, registerResult.user.id, {
      ...registerResult.user,
      preferredInsights: '',
      notifyDailyDigest: true,
      autoTaskCapture: true,
      autoLearnSpeakerProfiles: true,
    });

    expect(
      updatedUsers.find((user) => user.id === registerResult.user.id)?.autoLearnSpeakerProfiles
    ).toBe(true);
  });

  test('rejects invalid registration data and workspace join errors', async () => {
    await expect(
      registerUser([], [], {
        name: 'Anna',
        email: 'bad-email',
        password: 'tajne123',
        workspaceMode: 'create',
        workspaceName: 'Produkt',
      })
    ).rejects.toThrow('Podaj poprawny adres email.');

    await expect(
      registerUser([], [], {
        name: 'Anna',
        email: 'anna@example.com',
        password: '123',
        workspaceMode: 'create',
        workspaceName: 'Produkt',
      })
    ).rejects.toThrow('Haslo musi miec przynajmniej 6 znakow.');

    await expect(
      registerUser([], [], {
        name: 'Anna',
        email: 'anna@example.com',
        password: 'tajne123',
        workspaceMode: 'join',
      })
    ).rejects.toThrow('Podaj kod workspace, aby dolaczyc.');
  });

  test('changes password and handles reset edge cases', async () => {
    const registerResult = await registerUser([], [], {
      name: 'Marta',
      email: 'marta@example.com',
      password: 'haslo123',
      workspaceMode: 'create',
      workspaceName: 'Wsparcie',
    });

    const updatedUsers = await changeUserPassword(registerResult.users, registerResult.user.id, {
      currentPassword: 'haslo123',
      newPassword: 'nowehaslo1',
      confirmPassword: 'nowehaslo1',
    });

    await expect(
      loginUser(updatedUsers, registerResult.workspaces, {
        email: 'marta@example.com',
        password: 'nowehaslo1',
      })
    ).resolves.toMatchObject({ workspaceId: registerResult.workspaceId });

    await expect(
      changeUserPassword(registerResult.users, registerResult.user.id, {
        currentPassword: '',
        newPassword: 'nowehaslo1',
        confirmPassword: 'nowehaslo1',
      })
    ).rejects.toThrow('Uzupelnij wszystkie pola hasla.');
  });

  test('supports Google users and reset password validation', async () => {
    const { user, users, workspaces, workspaceId } = upsertGoogleUser([], [], {
      email: 'google@example.com',
      name: 'Google User',
      sub: 'google-sub-1',
      picture: 'https://example.com/avatar.png',
    });

    expect(user.provider).toBe('google');
    expect(workspaceId).toBeTruthy();
    expect(workspaces).toHaveLength(1);

    await expect(
      requestPasswordReset(users, {
        email: 'google@example.com',
      })
    ).rejects.toThrow('To konto korzysta z logowania Google. Reset hasla wykonaj w Google.');

    const registerResult = await registerUser([], [], {
      name: 'Kasia',
      email: 'kasia@example.com',
      password: 'haslo123',
      workspaceMode: 'create',
      workspaceName: 'R&D',
    });
    const resetResult = await requestPasswordReset(registerResult.users, {
      email: 'kasia@example.com',
    });

    await expect(
      resetPasswordWithCode(resetResult.users, {
        email: 'kasia@example.com',
        code: '000000',
        newPassword: 'nowehaslo1',
        confirmPassword: 'nowehaslo1',
      })
    ).rejects.toThrow('Kod resetu jest niepoprawny.');
  });

  test('normalizes preferred insights and updates existing Google users', async () => {
    const registerResult = await registerUser([], [], {
      name: 'Tomasz',
      email: 'tomasz@example.com',
      password: 'haslo123',
      workspaceMode: 'create',
      workspaceName: 'R&D',
    });

    const updated = updateUserProfile(registerResult.users, registerResult.user.id, {
      ...registerResult.user,
      preferredInsights: 'alpha, beta\ngamma',
    });

    expect(updated.find((user) => user.id === registerResult.user.id)?.preferredInsights).toEqual([
      'alpha',
      'beta',
      'gamma',
    ]);

    const workspace = createWorkspace('Core', registerResult.user.id);
    const existingGoogleUser = {
      ...registerResult.user,
      email: 'google@example.com',
      googleEmail: 'google@example.com',
      googleSub: 'sub_1',
      workspaceIds: [workspace.id],
      defaultWorkspaceId: workspace.id,
    };

    const result = upsertGoogleUser([existingGoogleUser], [workspace], {
      email: 'google@example.com',
      name: 'Google Update',
      sub: 'sub_1',
      picture: 'https://example.com/avatar.png',
    });

    expect(result.user.name).toBe('Google Update');
    expect(result.user.provider).toBe('google');
    expect(result.workspaceId).toBe(workspace.id);
  });
});
