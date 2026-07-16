with open('app.py', 'r', encoding='utf-8') as f:
    content = f.read()

target = '''    if given_name != db_given_name or surname != db_surname:'''

replacement = '''    # Allow names to be swapped (Given Name <-> Surname)
    is_exact_match = (given_name == db_given_name and surname == db_surname)
    is_swapped_match = (given_name == db_surname and surname == db_given_name)
    
    if not (is_exact_match or is_swapped_match):'''

content = content.replace(target, replacement)

with open('app.py', 'w', encoding='utf-8') as f:
    f.write(content)
