import React, { useState, useEffect } from 'react';
import { Shield, Plus, Trash2, Users, Check, AlertTriangle } from 'lucide-react';
import { AuthorizedUser } from '../types';
import { 
  subscribeAuthorizedUsers, 
  addFirestoreAuthorizedUser, 
  deleteFirestoreAuthorizedUser 
} from '../lib/firestore_sync';

interface UserManagementPanelProps {
  currentUserRole: 'admin' | 'viewer' | null;
}

export default function UserManagementPanel({ currentUserRole }: UserManagementPanelProps) {
  const [users, setUsers] = useState<AuthorizedUser[]>([]);
  const [emailInput, setEmailInput] = useState('');
  const [roleInput, setRoleInput] = useState<'admin' | 'viewer'>('viewer');
  
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    // Only subscribe to user updates if authorized
    if (!currentUserRole) return;

    const unsubscribe = subscribeAuthorizedUsers((syncedUsers) => {
      setUsers(syncedUsers);
    });

    return () => {
      unsubscribe && unsubscribe();
    };
  }, [currentUserRole]);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (currentUserRole !== 'admin') {
      setErrorMsg('Unauthorized: Only administrators can modify user permission credentials.');
      return;
    }

    const targetEmail = emailInput.trim().toLowerCase();
    if (!targetEmail) {
      setErrorMsg('Please specify a valid Gmail email operator address.');
      return;
    }

    if (!targetEmail.includes('@')) {
      setErrorMsg('Must be a valid email format.');
      return;
    }

    try {
      await addFirestoreAuthorizedUser({
        email: targetEmail,
        role: roleInput
      });

      setEmailInput('');
      setSuccessMsg(`Operator ${targetEmail} registered successfully.`);
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to authorize user record.');
    }
  };

  const handleDeleteUser = async (email: string) => {
    setErrorMsg('');
    setSuccessMsg('');

    if (currentUserRole !== 'admin') {
      setErrorMsg('Unauthorized: Only administrators can modify credentials.');
      return;
    }

    if (email.toLowerCase() === 'sunnyrocks1122@gmail.com') {
      setErrorMsg('Security Constraint: Primary Admin (sunnyrocks1122@gmail.com) cannot be isolated or removed.');
      return;
    }

    if (!confirm(`Are you sure you want to remove authorized login permissions for ${email}?`)) {
      return;
    }

    try {
      await deleteFirestoreAuthorizedUser(email);
      setSuccessMsg(`Permissions revoked for operator email: ${email}`);
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to delete authorized user.');
    }
  };

  return (
    <div id="user-management-panel" className="bg-[#262626] border border-[#393939] rounded-none p-6 shadow-md space-y-4 font-sans text-xs">
      <div className="flex items-center gap-2 border-b border-[#393939] pb-4 font-mono">
        <Users className="h-4.5 w-4.5 text-[#78a9ff]" />
        <h3 className="font-bold text-white text-xs uppercase tracking-wider">User Handshake Whitelist & Roles</h3>
      </div>

      <p className="text-xs text-[#c6c6c6] leading-relaxed">
        Only registered Gmail emails below are authorized to access the dashboard. Admins can view/write all assets, while viewers access diagnostics read-only.
      </p>

      {/* Admin registration Form */}
      {currentUserRole === 'admin' ? (
        <form onSubmit={handleAddUser} className="bg-[#161616] p-4 border border-[#393939] space-y-3">
          <div className="font-mono text-[9px] text-[#8d8d8d] uppercase tracking-wider font-bold">Authorize New White-listed Account</div>
          
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="email"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder="operator-gmail@gmail.com"
              className="flex-1 bg-[#262626] border border-[#393939] rounded-none px-3 py-1.5 text-white font-mono focus:outline-none focus:border-[#0f62fe]"
              required
            />
            
            <select
              value={roleInput}
              onChange={(e) => setRoleInput(e.target.value as 'admin' | 'viewer')}
              className="bg-[#262626] border border-[#393939] rounded-none px-3 py-1.5 text-slate-200 font-mono focus:outline-none"
            >
              <option value="viewer">VIEWER (Read-Only)</option>
              <option value="admin">ADMIN (Write & SSH Config)</option>
            </select>

            <button
              type="submit"
              className="bg-[#0f62fe] hover:bg-[#0353e9] border border-[#0f62fe] font-mono font-bold text-white uppercase text-[10px] tracking-wide px-4 py-1.5 rounded-none cursor-pointer transition-all shrink-0"
            >
              <span className="flex items-center gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                <span>Add Account</span>
              </span>
            </button>
          </div>

          {errorMsg && (
            <div className="text-[10px] font-mono text-[#ff8389] uppercase tracking-wide flex items-center gap-1.5 pt-1.5">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-[#ff8389]" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="text-[10px] font-mono text-[#42be65] uppercase tracking-wide flex items-center gap-1.5 pt-1.5">
              <Check className="h-3.5 w-3.5 shrink-0 text-[#24a148]" />
              <span>{successMsg}</span>
            </div>
          )}
        </form>
      ) : (
        <div className="bg-[#161616] p-3 text-[10px] font-mono text-[#8d8d8d] uppercase tracking-wide border border-[#393939]">
          🔒 Viewer Session: You are restricted from adding or deleting whitelist registers.
        </div>
      )}

      {/* Whitelisted Users Display Table */}
      <div className="border border-[#393939] overflow-x-auto bg-[#161616]">
        <table className="w-full text-left font-mono text-[10px] uppercase">
          <thead>
            <tr className="border-b border-[#393939] text-[#8d8d8d] tracking-wide bg-[#262626]">
              <th className="py-2.5 px-3">REGISTERED EMAIL</th>
              <th className="py-2.5 px-3">SYSTEM ROLE</th>
              {currentUserRole === 'admin' && <th className="py-2.5 px-3 text-right">ACTION</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#393939] text-[#c6c6c6]">
            {users.map((u) => (
              <tr key={u.email} className="hover:bg-[#202020]">
                <td className="py-2.5 px-3 font-semibold break-all text-white font-sans text-xs lowercase">
                  {u.email}
                </td>
                <td className="py-2.5 px-3">
                  <span className={`px-2 py-0.5 border text-[9px] ${
                    u.role === 'admin' 
                      ? 'border-[#24a148] text-[#42be65]/90 bg-[#24a148]/5' 
                      : 'border-[#78a9ff] text-[#78a9ff] bg-[#78a9ff]/5'
                  }`}>
                    {u.role}
                  </span>
                </td>
                {currentUserRole === 'admin' && (
                  <td className="py-1.5 px-3 text-right">
                    {u.email === 'sunnyrocks1122@gmail.com' ? (
                      <span className="text-[8px] text-[#8d8d8d] tracking-widest italic pr-2">PRIMARY</span>
                    ) : (
                      <button
                        onClick={() => handleDeleteUser(u.email)}
                        className="bg-[#262626] border border-[#393939] hover:border-[#ff8389] hover:bg-[#ff8389]/10 p-1.5 text-[#8d8d8d] hover:text-[#ff8389] cursor-pointer transition-all rounded-none"
                        title="Uninstall user permissions whitelist token"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={currentUserRole === 'admin' ? 3 : 2} className="py-6 px-3 text-center text-[#8d8d8d] italic">
                  Connecting and reading user registers list...
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
