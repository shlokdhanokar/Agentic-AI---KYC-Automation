with open('app.py', 'r', encoding='utf-8') as f:
    content = f.read()

target = """        if verification_status == 'VALID':
            add_log(document_id, '[Verification Agent] ✓ Document VALID — data matches database records')
        else:
            add_log(document_id, f'[Verification Agent] ✗ Document INVALID — {verification_message}')

        add_log(document_id, '[System] Saving verification results to database...')"""

replacement = """        if verification_status == 'VALID':
            add_log(document_id, '[Verification Agent] ✓ Document VALID — data matches database records')
            
            # --- OFAC SCREENING STEP ---
            add_log(document_id, '[OFAC Screening] Checking name against global sanctions lists...')
            status['status'] = 'ofac_screening'
            database.save_document_status(document_id, status)
            
            extracted_name = structured_data.get('Given Name', '') + " " + structured_data.get('Surname', '')
            extracted_name = extracted_name.strip().upper()
            
            import time
            time.sleep(1.5) # Simulate API latency
            
            # Mock high-risk list
            sanctions_list = ["OSAMA BIN LADEN", "PABLO ESCOBAR", "EL CHAPO", "KIM JONG UN", "VLADIMIR PUTIN"]
            
            if extracted_name and any(bad_actor in extracted_name for bad_actor in sanctions_list):
                verification_status = 'INVALID'
                verification_message = 'OFAC Screening Failed - Name matched against global sanctions watchlist'
                add_log(document_id, f'[OFAC Screening] ✗ {verification_message}')
            else:
                add_log(document_id, '[OFAC Screening] ✓ Name cleared (No sanctions matches found)')
            # ---------------------------
        else:
            add_log(document_id, f'[Verification Agent] ✗ Document INVALID — {verification_message}')

        add_log(document_id, '[System] Saving verification results to database...')"""

content = content.replace(target, replacement)

# Do the same for the non-logging background task (process_document)
target_no_log = """        verification_status, verification_message = verify_extracted_data(structured_data, doc_type, database_sheets)
        
        # Save final record to Redis instead of Excel"""

replacement_no_log = """        verification_status, verification_message = verify_extracted_data(structured_data, doc_type, database_sheets)
        
        if verification_status == 'VALID':
            status.update({'status': 'ofac_screening', 'message': 'Checking against OFAC sanctions lists...'})
            database.save_document_status(document_id, status)
            
            extracted_name = structured_data.get('Given Name', '') + " " + structured_data.get('Surname', '')
            extracted_name = extracted_name.strip().upper()
            
            import time
            time.sleep(1.5)
            
            sanctions_list = ["OSAMA BIN LADEN", "PABLO ESCOBAR", "EL CHAPO", "KIM JONG UN", "VLADIMIR PUTIN"]
            if extracted_name and any(bad_actor in extracted_name for bad_actor in sanctions_list):
                verification_status = 'INVALID'
                verification_message = 'OFAC Screening Failed - Name matched against global sanctions watchlist'
        
        # Save final record to Redis instead of Excel"""

content = content.replace(target_no_log, replacement_no_log)

with open('app.py', 'w', encoding='utf-8') as f:
    f.write(content)
