# Parent Upsert Testing & Verification

## Quick Test Plan

### Test 1: Create New Parent (No Duplicate)
1. Go to `public/teacher/students.html?sectionId=<valid_section_id>`
2. Click "Add New Student"
3. Enter a NEW parent email never used before
4. Fill in student name, ID, phone
5. Submit
6. **Verify:** Parent document created at `parents/{normalizedId}` with `ownerUids` array containing teacher UID and `linkedStudentIds` with the new student ID

### Test 2: Add Student to Existing Parent
1. In same section, click "Add New Student" again
2. **Use the same parent email** from Test 1
3. Enter different student name and ID
4. **Verify:** A confirmation modal appears: "Parent already exists. Do you want to link student [Name] to [Parent Name]?"
5. Click "Link student"
6. **Verify:** 
   - No new parent document created
   - Existing parent doc now has both student IDs in `linkedStudentIds`
   - `ownerUids` still contains teacher UID (no duplicates)

### Test 3: Blur Check (Email Blur Event)
1. Open "Add New Student" form
2. Type an email that already exists in Firestore parents collection
3. **Tab out or click away** from the email field (trigger blur)
4. **Verify:** A confirmation modal appears immediately asking if you want to link to the existing parent
5. If you click "Cancel", you can change the email

### Test 4: Concurrent Teacher Upsert
1. Have two teachers (different browser/session) both add students with the same parent email
2. Submit both forms at roughly the same time
3. **Verify:**
   - Parent document has both teachers in `ownerUids` array (no duplicates)
   - Parent document has both student IDs in `linkedStudentIds` (no duplicates)
   - Firestore `arrayUnion` handled concurrency correctly

### Test 5: Messages to Parent
1. Go to `public/teacher/messages.html?sectionId=<valid_section_id>`
2. Send a private message to a parent email
3. **Verify:** Message stored with `toParentId` equal to normalized email id (not a random doc id)

### Test 6: Migration Script (if duplicates exist)
1. Run migration in dry-run mode:
   ```bash
   cd scripts
   node migrate-parents.js
   ```
2. Review console output showing duplicates to be merged
3. Run migration with apply flag:
   ```bash
   node migrate-parents.js --apply
   ```
4. **Verify:**
   - Console shows canonical doc created
   - Duplicate docs deleted
   - All `linkedStudentIds` and `ownerUids` merged into canonical doc

## Security Rule Tests

### Test 7: Teacher Access
1. Teacher can read parent doc where teacher UID is in `ownerUids`
2. Teacher can update parent doc (add more `linkedStudentIds` or `ownerUids`)

### Test 8: Parent Access (when parent mobile app is integrated)
1. Parent signs in with Google OAuth (email matches parent doc `email`)
2. Parent can read their own doc at `parents/{normalizedId}`
3. Parent **cannot** update `linkedStudentIds` or `email` (rules reject)
4. Parent **can** update only `name` and `lastLoginAt` fields

## Acceptance Checklist

- [ ] Adding a parent with an email that already exists does NOT create a new parent document
- [ ] Teachers can add student IDs to parent document using `FieldValue.arrayUnion`
- [ ] Parent lookup from mobile uses `parents/{normalizedId}` and always returns all `linkedStudentIds`
- [ ] Security rules enforce only teachers can modify `linkedStudentIds`; parents can only read their own doc and update limited fields
- [ ] UI shows when an existing parent is found and confirms linking instead of creating a duplicate
- [ ] Email is normalized: lowercase, trimmed, and base64url-encoded for consistent ID
- [ ] Migration script successfully merges duplicate parent docs (tested in staging first)

## Common Issues & Troubleshooting

### Issue: "Parent not found" when sending message
- **Cause:** Parent doc not created yet or email mismatch
- **Fix:** Ensure parent email in students matches parent email in messages

### Issue: Duplicate parent docs still appearing
- **Cause:** Old code path or concurrent writes before migration
- **Fix:** Run `migrate-parents.js --apply` to clean up duplicates

### Issue: Parent can't read their doc (mobile app)
- **Cause:** Email in Firebase Auth token doesn't match parent doc `email` field
- **Fix:** Ensure `email` field in parent doc is lowercase and trimmed; sign-in uses matching Google account

### Issue: Confirmation modal not appearing on blur
- **Cause:** DOM element not yet loaded or blur event not attached
- **Fix:** Ensure `DOMContentLoaded` event fires before attaching blur handler

## Next Steps

1. Deploy updated Firestore rules to production (or test in emulator first)
2. Run migration script in staging environment
3. Test with small group of teachers
4. Monitor Firestore logs for any rule violations
5. Integrate mobile app to use `parents/{normalizedId}` for parent lookup and real-time updates
