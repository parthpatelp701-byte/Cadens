/** Disabled until server-side deletion can verify storage, membership and auth cleanup atomically. */
export async function wipeMyCadensData():Promise<void> { throw new Error('Account deletion is not available in this beta yet. Your data has not been changed.') }
export async function deleteAccountAndSignOut(_signOut:()=>Promise<void>):Promise<void> {
 // Never wipe data before discovering whether account deletion is available.
 await wipeMyCadensData()
}
