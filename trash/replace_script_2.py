with open('app.py', 'r', encoding='utf-8') as f:
    content = f.read()

target = """    except Exception as e:
        print(f"Gemini API Error: {e}")
        gpt_response = "{}\""""

replacement = """    except Exception as e:
        print(f"Gemini API Error: {e}")
        gpt_response = f'{{"Error": "Gemini API failed: {str(e)}" }}'"""

content = content.replace(target, replacement)

with open('app.py', 'w', encoding='utf-8') as f:
    f.write(content)
